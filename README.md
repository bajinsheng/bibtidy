# bibtidy

Welcome to bibtidy, a simple tool for simplifying the creation of your BibTeX files! *Changes: We changed the online retriving mode into offline mode due to querying rate limiti.*

## Welcome Stars
If you like this tool, don't forget to star it! Your support is my motivation to keep updating this tool.

## Features
Checking: Automatically fix incorrect and fill incomplete entries with reference to DBLP. We adopt offline databases to retrieve bibtex entries, because all online APIs have rate limitations.

## Requirements
Python 3.10.0
Ubuntu 22.04
(Other versions are not tested. Welcome to test and report.)

## Installation
Download this repo. Then, we need to install and configure baseX database as the backend database. It may require more than 10 minutes to initialize the database.
```bash
./init.sh
```


## Usage: Checking a BibTeX file
Suppose we have a file named "test.bib" with some BibTex entries from unknown sources:
```bibtex
@misc{ba2023qpg,
      title={Testing Database Engines via Query Plan Guidance}, 
      author={Jinsheng Ba and Rigger, Manuel},
      year={2023},
      eprint={2312.17510},
      archivePrefix={arXiv},
      primaryClass={cs.CR}
}

```
We can check and autofix it by running the following command:
```python
bibtidy test.bib
```

The output will be in the file `test_revised.bib`:
```bibtex
@inproceedings{qpg,
 author = {Jinsheng Ba and Manuel Rigger},
 booktitle = {ICSE},
 crossref = {conf/icse/2023},
 doi = {10.1109/ICSE48619.2023.00174},
 month = {May},
 pages = {2060-2071},
 title = {Testing Database Engines via Query Plan Guidance.},
 url = {https://doi.org/10.1109/ICSE48619.2023.00174},
 year = {2023}
}
```
