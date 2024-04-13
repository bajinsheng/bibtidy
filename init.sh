sudo apt install basex -y
wget https://dblp.org/xml/dblp.xml.gz
gunzip dblp.xml.gz
wget https://dblp.org/xml/dblp.dtd

basex -c "ALTER PASSWORD admin admin"
basex -c "SET INTPARSE true; SET DTD true; SET TEXTINDEX true; SET TOKENINDEX true; SET FTINDEX true; CREATE DB dblp dblp.xml"

basexserver -S