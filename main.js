importPackage(java.util);
importPackage(org.apache.jena.riot);
importPackage(org.apache.jena.riot.system);
importPackage(com.hp.hpl.jena.rdf.model);
importPackage(com.google.appengine.api.datastore);
importPackage(org.apache.http.client.utils);

var apejs = require("apejs.js");
var select = require('select.js');

apejs.urls = {
    "/": {
        get: function(request, response, query) {
            var subject = request.getParameter('subject');
            var predicate = request.getParameter('predicate');
            var object = request.getParameter('object');
            var page = request.getParameter('page');

            var itemsPerPage = 100;

            var filter = {};


            if(subject && !subject.equals(''))
                filter['subject'] = subject;
            if(predicate && !predicate.equals(''))
                filter['predicate'] = predicate;
            if(object && !object.equals(''))
                filter['object'] = object;

            if(page)
                page = parseInt(page, 10);
            else
                page = 1;

            var model = ModelFactory.createDefaultModel();


            // query datastore
            var query = new Query('triple');
            for(var x in filter) {
                query.addFilter(x, Query.FilterOperator.EQUAL, filter[x]);
            }
            var datastoreService = DatastoreServiceFactory.getDatastoreService();
            var preparedQuery = datastoreService.prepare(query);

            var totalItems = preparedQuery.countEntities(FetchOptions.Builder.withDefaults());

            // read controls into model
            readControls(request, model, totalItems, itemsPerPage, page);

            var fetchOptions = FetchOptions.Builder.withDefaults();
            fetchOptions = fetchOptions.limit(itemsPerPage);
            fetchOptions = fetchOptions.offset((page - 1) * itemsPerPage);


            var result = preparedQuery.asList(fetchOptions).toArray();
            for(var i=0; i<result.length; i++) {
                var reader = new StringReader(result[i].getProperty('triple'));
                model.read(reader, null, 'N-TRIPLE');
            }
        
            var contentType = request.getContentType();
            if(!contentType)
                contentType = 'text/html';

            var lang = RDFLanguages.contentTypeToLang(contentType);
            if(lang == null) {
                contentType = 'text/turtle';
                lang = 'TURTLE';
            } else {
                lang = lang.getName();
            }

            response.setContentType(contentType);
            response.setHeader("Access-Control-Allow-Origin", "*");
            model.write(response.getOutputStream(), lang);
        },
    },
    '/parse': {
        get: function(request, response, query) {
            // delete all
            select("triple")
                .find()
                .del();


            var sink = new JavaAdapter(StreamRDFBase, {
                triple: function(triple) {
                    var s = triple.getSubject();
                    var p = triple.getPredicate();
                    var o = triple.getObject();

                    var subject = s.toString();
                    var predicate = p.toString();
                    var object = o.toString();

                    var os = new ByteArrayOutputStream();
                    RDFDataMgr.writeTriples(os, Collections.singleton(triple).iterator())

                    select('triple')
                        .add({
                            "subject"  : subject,
                            "predicate": predicate,
                            "object": object,
                            "triple": os.toString()
                        });
                    print(response).html('Added triple: '+ subject + '<br>');
                }

            })

            var url = getServletConfig().getServletContext().getResource("/rdf/")
            var dir = new File(url.toURI());
            var files = dir.listFiles();
            for(var i=0; i<files.length; i++) {
                var file = files[i];
                var inputStream = new FileInputStream(file);
                RDFDataMgr.parse(sink, inputStream, RDFLanguages.filenameToLang(file.getName()));

            }

        }
    }
};

function readControls(request, model, totalItems, itemsPerPage, currentPage) {
    var uri = request.getScheme() + "://" +   // "http" + "://
             request.getServerName();
    if(!request.getServerPort() != 80) {
        uri += ':' + request.getServerPort();
    }
    uri += request.getRequestURI();

    var queryString = (request.getQueryString() != null ? "?" +
                 request.getQueryString() : "");;
    var fullUri = uri + queryString;
    var firstPage = new URIBuilder(fullUri); 
    firstPage.setParameter('page', 1);
    var previousPage = new URIBuilder(fullUri);
    previousPage.setParameter('page', currentPage - 1);
    var nextPage = new URIBuilder(fullUri);
    nextPage.setParameter('page', currentPage + 1);

    var controls = '\
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.\
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.\
@prefix owl: <http://www.w3.org/2002/07/owl#>.\
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.\
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.\
@prefix dc: <http://purl.org/dc/terms/>.\
@prefix dcterms: <http://purl.org/dc/terms/>.\
@prefix dc11: <http://purl.org/dc/elements/1.1/>.\
@prefix foaf: <http://xmlns.com/foaf/0.1/>.\
@prefix geo: <http://www.w3.org/2003/01/geo/wgs84_pos#>.\
@prefix dbpedia: <http://dbpedia.org/resource/>.\
@prefix dbpedia-owl: <http://dbpedia.org/ontology/>.\
@prefix dbpprop: <http://dbpedia.org/property/>.\
@prefix hydra: <http://www.w3.org/ns/hydra/core#>.\
@prefix void: <http://rdfs.org/ns/void#>.\
@prefix : <'+uri+'>.\
\
<'+uri+'#dataset> a void:Dataset, hydra:Collection;\
    void:subset :ldf;\
    void:uriLookupEndpoint "'+uri+'{?subject,predicate,object}";\
    hydra:search _:triplePattern.\
\n\
_:triplePattern hydra:template "'+uri+'{?subject,predicate,object}";\
    hydra:mapping _:subject, _:predicate, _:object.\
\n\
_:subject hydra:variable "subject";\
    hydra:property rdf:subject.\
\n\
_:predicate hydra:variable "predicate";\
    hydra:property rdf:predicate.\
\n\
_:object hydra:variable "object";\
    hydra:property rdf:object.\
\n\
:ldf a hydra:Collection, hydra:PagedCollection;\
    hydra:totalItems "'+totalItems+'"^^xsd:integer;\
    void:triples "'+totalItems+'"^^xsd:integer;\
    hydra:itemsPerPage "'+itemsPerPage+'"^^xsd:integer;\
    hydra:firstPage <'+firstPage +'> .';

    if(currentPage > 1)
        controls += ':ldf hydra:previousPage <'+previousPage +'> .';

    controls += ':ldf hydra:nextPage <'+nextPage +'> .';

    var reader = new StringReader(controls);
    model.read(reader, null, 'TURTLE');

}

// simple syntax sugar
function print(response) {
    return {
        html: function(str) {
            if(str) {
                response.setContentType('text/html');
                response.getWriter().println(''+str);
            }
        },
        json: function(j) {
            if(j) {
                var jsonString = JSON.stringify(j);
                response.setContentType("application/json");
                response.getWriter().println(jsonString);
            }
        }
    };
}
