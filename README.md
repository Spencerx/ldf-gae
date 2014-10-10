ldf-gae
=======

Basic Linked Data Fragment (Triple Pattern Fragment) server for Google App Engine.


# How to use

LDF-GAE requires Java 1.7.x or greater, and the latest Java App Engine SDK9 to run. All the other dependencies are contained within the downloaded package. Follow these steps to run LDF-GAE:

1. Download the source-code from: https://github.com/lmatteis/ldf-gae
2. Store the RDF sources you wish to parse in the ldf-gae/rdf/ directory.
3. The ldf-gae/ folder acts as a standard App Engine webapp. Follow the App Engine instructions to deploy it to the App Engine cloud: https://developers.google.com/appengine/docs/java/
4. Once the app is uploaded to App Engine, initiate the RDF parsing routine by accessing the /parse page: http://<app-id>.appspot.com/parse
5. Finally, access the root page to start querying the TPF server: http://<app-id>.appspot.com/
