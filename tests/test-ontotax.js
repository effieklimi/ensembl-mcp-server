#!/usr/bin/env node

/**
 * Test script for ensembl_ontotax tool
 * Tests ontology term search and NCBI taxonomy queries
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.js";

const client = new EnsemblApiClient();

async function testOntoTax() {
  console.log("🔬 Testing ensembl_ontotax tool\n");

  const tests = [
    {
      name: "Search GO terms for apoptosis",
      params: {
        query_type: "ontology",
        search_term: "apoptosis",
      },
    },
    {
      name: "Search GO terms for DNA repair",
      params: {
        query_type: "ontology",
        search_term: "DNA repair",
      },
    },
    {
      name: "Get specific GO term details",
      params: {
        query_type: "ontology",
        ontology_id: "GO:0006915",
      },
    },
    {
      name: "Search SO terms for transcript",
      params: {
        query_type: "ontology",
        search_term: "transcript",
        ontology: "SO",
      },
    },
    {
      name: "Get taxonomy info for human",
      params: {
        query_type: "taxonomy",
        taxonomy_id: "9606",
      },
    },
    {
      name: "Get taxonomy info for mouse",
      params: {
        query_type: "taxonomy",
        taxonomy_id: "10090",
      },
    },
    {
      name: "Search taxonomy by name",
      params: {
        query_type: "taxonomy",
        search_term: "Homo sapiens",
      },
    },
    {
      name: "Search for primate taxonomy",
      params: {
        query_type: "taxonomy",
        search_term: "Primates",
      },
    },
    {
      name: "Get descendants of mammals",
      params: {
        query_type: "taxonomy",
        taxonomy_id: "40674",
        include_descendants: true,
      },
    },
    {
      name: "Search EFO terms for cancer",
      params: {
        query_type: "ontology",
        search_term: "cancer",
        ontology: "EFO",
      },
    },
    {
      name: "Search MONDO disease terms",
      params: {
        query_type: "ontology",
        search_term: "diabetes",
        ontology: "MONDO",
      },
    },
    {
      name: "Get ancestors of human taxonomy",
      params: {
        query_type: "taxonomy",
        taxonomy_id: "9606",
        include_ancestors: true,
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.getOntologyTaxonomy(test.params);

      if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} results`);

        if (result.length > 0) {
          const first = result[0];

          // Ontology results
          if (first.term) {
            console.log(`   First term: ${first.term} (${first.accession})`);
            if (first.definition) {
              console.log(
                `   Definition: ${first.definition.substring(0, 100)}...`
              );
            }
            if (first.namespace) {
              console.log(`   Namespace: ${first.namespace}`);
            }
          }

          // Taxonomy results
          if (first.scientific_name) {
            console.log(`   Species: ${first.scientific_name}`);
            if (first.common_name) {
              console.log(`   Common name: ${first.common_name}`);
            }
            if (first.taxonomy_id) {
              console.log(`   Taxonomy ID: ${first.taxonomy_id}`);
            }
            if (first.rank) {
              console.log(`   Taxonomic rank: ${first.rank}`);
            }
          }

          // Show top 5 results summary
          if (result.length > 1) {
            const summary = result
              .slice(0, 5)
              .map(
                (r) =>
                  r.term || r.scientific_name || r.accession || r.taxonomy_id
              )
              .join(", ");
            console.log(`   Top results: ${summary}`);
          }
        }
      } else if (result) {
        console.log(`✅ Single result:`);

        // Single ontology term
        if (result.term) {
          console.log(`   Term: ${result.term} (${result.accession})`);
          if (result.definition) {
            console.log(`   Definition: ${result.definition}`);
          }
          if (result.synonyms && result.synonyms.length > 0) {
            console.log(
              `   Synonyms: ${result.synonyms.slice(0, 3).join(", ")}`
            );
          }
          if (result.children && result.children.length > 0) {
            console.log(`   Child terms: ${result.children.length}`);
          }
        }

        // Single taxonomy entry
        if (result.scientific_name) {
          console.log(`   Species: ${result.scientific_name}`);
          if (result.common_name) {
            console.log(`   Common name: ${result.common_name}`);
          }
          if (result.lineage) {
            console.log(`   Lineage: ${result.lineage.slice(-3).join(" > ")}`);
          }
          if (result.children && result.children.length > 0) {
            console.log(`   Child taxa: ${result.children.length}`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting invalid ontology ID...");
    await client.getOntologyTaxonomy({
      query_type: "ontology",
      ontology_id: "GO:9999999",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid taxonomy ID...");
    await client.getOntologyTaxonomy({
      query_type: "taxonomy",
      taxonomy_id: "9999999",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting empty search term...");
    await client.getOntologyTaxonomy({
      query_type: "ontology",
      search_term: "",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testOntoTax().catch(console.error);
