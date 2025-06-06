#!/usr/bin/env node

/**
 * Test script for ensembl_lookup tool
 * Tests ID/symbol lookup, cross-references, and variant recoding
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.ts";

const client = new EnsemblApiClient();

async function testLookup() {
  console.log("🔍 Testing ensembl_lookup tool\n");

  const tests = [
    {
      name: "Look up BRCA1 gene by symbol",
      params: {
        identifier: "BRCA1",
        lookup_type: "symbol",
        species: "homo_sapiens",
        expand: ["Transcript"],
      },
    },
    {
      name: "Look up TP53 gene by Ensembl ID",
      params: {
        identifier: "ENSG00000141510",
        lookup_type: "id",
        expand: ["Transcript", "Exon"],
      },
    },
    {
      name: "Look up EGFR transcript",
      params: {
        identifier: "ENST00000275493",
        lookup_type: "id",
      },
    },
    {
      name: "Find cross-references for BRCA1",
      params: {
        identifier: "ENSG00000012048",
        lookup_type: "xrefs",
      },
    },
    {
      name: "Look up external reference (HGNC symbol)",
      params: {
        identifier: "TP53",
        lookup_type: "xrefs",
        species: "homo_sapiens",
        external_db: "HGNC",
      },
    },
    {
      name: "Look up gene cross-references for EGFR",
      params: {
        identifier: "ENSG00000146648",
        lookup_type: "xrefs",
      },
    },
    {
      name: "Look up with ID expansion",
      params: {
        identifier: "ENSG00000141510",
        lookup_type: "id",
        expand: ["Transcript"],
      },
    },
    {
      name: "Look up mouse Trp53 gene",
      params: {
        identifier: "Trp53",
        lookup_type: "symbol",
        species: "mus_musculus",
      },
    },
    {
      name: "Look up gene cross-references by symbol",
      params: {
        identifier: "BRCA1",
        lookup_type: "xrefs",
        species: "homo_sapiens",
        external_db: "RefSeq_mRNA",
      },
    },
    {
      name: "Look up WikiGene references",
      params: {
        identifier: "TP53",
        lookup_type: "xrefs",
        species: "homo_sapiens",
        external_db: "WikiGene",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.performLookup(test.params);

      if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} results`);
        if (result.length > 0) {
          const first = result[0];

          // Handle xrefs results
          if (first.dbname || first.primary_id) {
            console.log(
              `   First result: ${first.display_id || first.primary_id} (${
                first.dbname || "xref"
              })`
            );
            if (first.description) {
              console.log(
                `   Description: ${first.description.substring(0, 80)}...`
              );
            }
          }

          // Handle standard gene/transcript results
          else {
            console.log(
              `   First result: ${first.display_name || first.id} (${
                first.biotype || first.object_type
              })`
            );
            if (first.seq_region_name) {
              console.log(
                `   Location: ${first.seq_region_name}:${first.start}-${first.end}`
              );
            }
          }
        }
      } else if (result) {
        console.log(`✅ Single result: ${result.display_name || result.id}`);
        if (result.description) {
          console.log(
            `   Description: ${result.description.substring(0, 100)}...`
          );
        }
        if (result.seq_region_name) {
          console.log(
            `   Location: ${result.seq_region_name}:${result.start}-${result.end}`
          );
        }
        if (result.biotype) {
          console.log(`   Biotype: ${result.biotype}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting invalid gene symbol...");
    await client.performLookup({
      identifier: "FAKEGENE123",
      lookup_type: "symbol",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid Ensembl ID...");
    await client.performLookup({
      identifier: "ENSG99999999",
      lookup_type: "id",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testLookup().catch(console.error);
