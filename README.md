# bibtidy

Welcome to bibtidy, a simple tool for simplifying the creation of your BibTeX files! 

## Welcome Stars
If you like this tool, don't forget to star it! Your support is my motivation to keep updating this tool.

## Features
1. Searching: Search a keyword from DBLP and show all relevant BibTex entries in order.
2. Checking: Automatically fix incorrect and fill incomplete entries with reference to DBLP.

## Requirements
Python 3.10.0
(Other versions are not tested. Welcome to test and report.)

## Installation
```shell
pip3 install git+https://github.com/bajinsheng/bibtidy@release
```
If you want to install it in an isolated virtualenv, you can use `pipx` instead:
```shell
pipx install git+https://github.com/bajinsheng/bibtidy@release
```

## Usage 1: Searching for a paper
```python
bibtidy --keyword "How Good Are Query Optimizers"
```
The output will be:
```bibtex
@article{viktor2015how,
 author = {Viktor Leis and
Andrey Gubichev and
Atanas Mirchev and
Peter A. Boncz and
Alfons Kemper and
Thomas Neumann},
 bibsource = {dblp computer science bibliography, https://dblp.org},
 biburl = {https://dblp.org/rec/journals/pvldb/LeisGMBK015.bib},
 doi = {10.14778/2850583.2850594},
 journal = {Proc. {VLDB} Endow.},
 number = {3},
 pages = {204--215},
 timestamp = {Sat, 25 Apr 2020 01:00:00 +0200},
 title = {How Good Are Query Optimizers, Really?},
 url = {http://www.vldb.org/pvldb/vol9/p204-leis.pdf},
 volume = {9},
 year = {2015}
}
```

## Usage 2: Checking a BibTeX file
Suppose we have a file named "test.bib" with some BibTex entries from unknown sources:
```bibtex
@misc{ba2022efficient,
      title={Efficient Greybox Fuzzing to Detect Memory Errors}, 
      author={Jinsheng Ba and Gregory J. Duck and Abhik Roychoudhury},
      year={2022},
      eprint={2204.02773},
      archivePrefix={arXiv},
      primaryClass={cs.CR}
}

```
We can check and autofix it by running the following command:
```python
bibtidy --file "test.bib"
```

The output will be:
```bibtex
@inproceedings{ba2022efficient,
 author = {Jinsheng Ba and
Gregory J. Duck and
Abhik Roychoudhury},
 bibsource = {dblp computer science bibliography, https://dblp.org},
 biburl = {https://dblp.org/rec/conf/kbse/BaDR22.bib},
 booktitle = {37th {IEEE/ACM} International Conference on Automated Software Engineering,
{ASE} 2022, Rochester, MI, USA, October 10-14, 2022},
 doi = {10.1145/3551349.3561161},
 pages = {37:1--37:12},
 publisher = {{ACM}},
 timestamp = {Sun, 15 Jan 2023 00:00:00 +0100},
 title = {Efficient Greybox Fuzzing to Detect Memory Errors},
 url = {https://doi.org/10.1145/3551349.3561161},
 year = {2022}
}
```
