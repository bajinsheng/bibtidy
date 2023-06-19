import setuptools

version = "0.0.1"

def load_readme():
    with open("README.md") as f:
        return f.read()

setuptools.setup(
    name="bibtidy", 
    version=version,
    author='Jinsheng Ba',
    author_email='bajinsheng@gmail.com',
    description="A tool for simplifying BiBTex creation.",
    long_description=load_readme(),
    long_description_content_type="text/markdown",
    url="https://github.com/bajinsheng/bibtidy",
    py_modules=["bibtidy"],
    packages=setuptools.find_packages(),
    install_requires=['bibtexparser==1.4.0',
                      'requests',
                    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='>=3.6',
    entry_points={
        "console_scripts": [
            "bibtidy = bibtidy:main"
        ]
    }
)
