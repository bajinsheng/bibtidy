#!/usr/bin/python3

import argparse
import requests
import bibtexparser
from difflib import SequenceMatcher


def dblp_search(keyword):
    """
    Search the library catalog for a keyword and return the results.
    """
    base_url = "https://dblp.org/search/publ/api"
    params = {
    "q": keyword,   # The search keyword
    "h": 10,              # The maximum retrieved items
    "format": "bib"      # The return output format
    }
    response = requests.get(base_url, params=params)
    # Jude the response status
    if response.status_code != 200:
        raise AssertionError("Error occurs when fetching the data from DBLP. Status code: " + str(response.status_code))
    bib = bibtexparser.loads(response.text)
    return bib.entries

def googlescholar_naming_conversion(entries):
    """
    Convert the id to the Google Scholar style.
    """
    for item in entries:
        entry = item['entry']
        if 'author' in entry and 'year' in entry and 'title' in entry:
            author = entry['author'].split(' ')[0].lower()
            publication = entry['title'].split(' ')[0].lower()
            entry['ID'] = author + entry['year'] + publication
    return entries

def bibtex_match_publication(entries, title):
    """
    Retrieve two lists of most relevant entries from the library as non-eprints and eprints.
    """
    selected_entries = []
    selected_eprint_entries = []
    for entry in entries:
        similarity = SequenceMatcher(None, entry['title'], title).ratio()
        if 'eprint' in entry:
            selected_eprint_entries.append({"entry": entry, "similarity": similarity})
        else:
            selected_entries.append({"entry": entry, "similarity": similarity})

    sorted_selected_entries = sorted(selected_entries, key=lambda x: x["similarity"], reverse=True)
    sorted_selected_eprint_entries = sorted(selected_eprint_entries, key=lambda x: x["similarity"], reverse=True)
    sorted_selected_entries.extend(sorted_selected_eprint_entries)
    return sorted_selected_entries

def search_keyword(args):
    '''
    Usage 1: search the keyword in the dblp database and return the results.
    '''
    entries = dblp_search(args.keyword)
    if (len(entries) == 0):
        print("Error: No results found in the DBLP database.")
        exit (1)
    
    selected_entries = bibtex_match_publication(entries, args.keyword)
    
    if len(selected_entries) > args.max:
        selected_entries = selected_entries[:args.max]
    if args.naming == 'googlescholar':
        selected_entries = googlescholar_naming_conversion(selected_entries)
    return selected_entries
    
def bibtex_correction(args):
    '''
    Usage 2: correct the bibtex file with the dblp database and return the results.
    '''
    with open(args.file) as bibtex_file:
        bibtex_library = bibtexparser.load(bibtex_file)

    selected_entries = []
    for entry in bibtex_library.entries:
        entries = dblp_search(entry['title'])
        if (len(entries) > 0):
            selected_entry = bibtex_match_publication(entries, entry['title'])[0]
            selected_entry['entry']['ID'] = entry['ID']
        else:
            print("Warning: No results found in the DBLP database for the title: " + entry['title'])
            selected_entry = {"entry": entry, "similarity": 1}
        selected_entries.append(selected_entry)
    return selected_entries



def main():
    parser = argparse.ArgumentParser(description='bibtidy: Make your research easier with correct citations!')
    group = parser.add_mutually_exclusive_group()
    group.add_argument('-k', '--keyword', type=str, help='Usage 1: specify the keyword for searching the most relevant bibtex entry (This option is exclusive with -f/--file)')
    group.add_argument('-f', '--file', type=str, help='Usage 2: specify the bibtex file for bibtex checking (This option is exclusive with -k/--keyword)')

    parser.add_argument('-m', '--max', type=int, default=1, help='The maximum number of candidates output for keyword search. Always 1 for bibtex checking.')
    parser.add_argument('-o', '--output', type=str, default='stdout', help='the file path of the output')
    parser.add_argument('-n', '--naming', choices=['dblp', 'googlescholar'], default='googlescholar', help='naming convention of id')
    parser.add_argument('-v', '--version', action='version', version='%(prog)s 0.0.1')
    parser.add_argument('-d', '--debug', action='store_true', default=False, help='enable debug mode')

    args = parser.parse_args()
    if not args.debug and not (args.file or args.keyword):
        parser.error("At least one option (--file or --keyword) must be specified.")

    selected_entries = []
    if (args.keyword):
        selected_entries = search_keyword(args)
    elif (args.file):
        selected_entries = bibtex_correction(args)
    else:
        exit(1)

    # Assembly the final result
    dblp_library = bibtexparser.bibdatabase.BibDatabase()
    dblp_library.entries = [entry['entry'] for entry in selected_entries]
    result = bibtexparser.dumps(dblp_library)
    if args.output == 'stdout':
        print(result)
    else:
        with open(args.output, 'w') as f:
            f.write(result)


if __name__ == "__main__":
    main()
