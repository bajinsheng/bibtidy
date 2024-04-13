#!/usr/bin/python3
import argparse
import os, re
import bibtexparser
from difflib import SequenceMatcher
from bibtexparser.bparser import BibTexParser
import BaseXClient
from lxml import etree
from tqdm import tqdm

session = BaseXClient.Session('localhost', 1984, 'admin', 'admin')

def dblp_search(title):
    data = session.execute("xquery for $x in doc('dblp')/dblp/* where $x/title contains text '" + title + "' return $x")
    data = "<root>\n" + data + "\n</root>"
    root = etree.fromstring(data)
    return root

def bibtex_prioritize(entries, title):
    """
    Prioritize the entries according to the similarity of the title.
    """
    selected_entries = []
    selected_eprint_entries = []
    for entry in entries:
        similarity = SequenceMatcher(None, entry.find('title').text, title).ratio()
        if entry.find('journal') is not None and entry.find('journal').text == 'CoRR': # Lower the priorities of the Arxiv papers
            selected_eprint_entries.append({"entry": entry, "similarity": similarity})
        else:
            selected_entries.append({"entry": entry, "similarity": similarity})

    sorted_selected_entries = sorted(selected_entries, key=lambda x: x["similarity"], reverse=True)
    sorted_selected_eprint_entries = sorted(selected_eprint_entries, key=lambda x: x["similarity"], reverse=True)
    sorted_selected_entries.extend(sorted_selected_eprint_entries)
    return sorted_selected_entries
    
def write_bibtex(entry, output):
    """
    Write the bibtex entry to the file.
    """
    dblp_library = bibtexparser.bibdatabase.BibDatabase()
    dblp_library.entries = [entry]
    writer = bibtexparser.bwriter.BibTexWriter()
    writer.order_entries_by = None
    result = bibtexparser.dumps(dblp_library, writer=writer)
    with open(output, "a") as f:
        f.write(result)


def bibtex_checking(bibtex_library, args):
    '''
    correct the bibtex file with the dblp database and return the results.
    '''
    for entry in tqdm(bibtex_library.entries, desc='Processing bibtex', unit='entry'):
        old_title = entry['title']
        bibtex_matched = dblp_search(old_title)
        if (len(bibtex_matched) > 0):
            bibtex_best_match = bibtex_prioritize(bibtex_matched, entry['title'])[0]
            authors = ""
            for key in bibtex_best_match['entry']:
                if key.tag == 'author':
                    if authors != "":
                        authors += " and "
                    if key.text.split(" ")[-1].isdigit(): # Remove the number at the end of the author name
                        authors += key.text.rsplit(' ', 1)[0]
                    authors += re.sub(r'\s*\d+$', '', key.text)
                elif key.tag == 'url' or key.tag == 'crossref': # Ignore interrnal tags
                    continue
                elif key.tag == 'ee': # Convert DOI
                    entry['url'] = key.text
                    if key.text.startswith('https://doi.org/'): # Some publishers, such as USENIX, do not provide DOI
                        entry['doi'] = key.text.split('https://doi.org/')[1].rstrip('}')
                else:
                    entry[key.tag] = key.text
            if authors != "":
                entry['author'] = authors
            entry['ENTRYTYPE'] = bibtex_best_match['entry'].tag # Update the entry type

            # Reporting results
            if bibtex_best_match['similarity'] < 0.5 and args.debug:
                print("[Debug] \"" + entry['title'] + "\" has no similar entires.")   
            elif bibtex_best_match['similarity'] < 0.8:
                print("[Warning] Suspicious update: \"" + old_title + "\" -> \"" + entry['title'] + "\". Please check whether it is correct.")
            elif bibtex_best_match['similarity'] < 1 and args.debug:
                print("[Debug] \"" + old_title + "\" -> \"" + entry['title'] + "\".")
            write_bibtex(entry, args.file + "_revised.bib")
        else:
            if args.debug:
                print("[Debug] \"" + entry['title'] + "\" is not found in the DBLP database.")
    return

def main():
    parser = argparse.ArgumentParser(description='bibtidy: Make your research easier with correct citations!')
    parser.add_argument('file')
    parser.add_argument('-o', '--output', type=str, default='stdout', help='the file path of the output')
    parser.add_argument('-d', '--debug', action='store_true', default=False, help='enable debug mode')
    args = parser.parse_args()

    if os.path.isfile(args.file + "_revised.bib") == True:
        print("The output file already exists! Please delete it first.")
        return
    
    with open(args.file) as bibtex_file:
        parser = BibTexParser()
        parser.ignore_nonstandard_types = False
        bibtex_library = bibtexparser.load(bibtex_file, parser)
        bibtex_checking(bibtex_library, args)
    
    # close session
    if session:
        session.close()


if __name__ == "__main__":
    main()