#!/usr/bin/env node

/**
 * Test script for ensembl_regulatory tool
 * Tests protein features, domains, and binding matrices
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.ts";

const client = new EnsemblApiClient();

async function testRegulatory() {
  console.log("🔬 Testing ensembl_regulatory tool\n");

  const tests = [
    {
      name: "Find protein features for EGFR protein",
      params: {
        protein_id: "ENSP00000275493",
        species: "homo_sapiens",
      },
    },
    {
      name: "Find protein features for TP53 protein",
      params: {
        protein_id: "ENSP00000269305",
        species: "homo_sapiens",
      },
    },
    {
      name: "Find protein domains for BRCA1 protein",
      params: {
        protein_id: "ENSP00000350283",
        species: "homo_sapiens",
      },
    },
    {
      name: "Find protein features for mouse Trp53",
      params: {
        protein_id: "ENSMUSP00000061689",
        species: "mus_musculus",
      },
    },
    {
      name: "Get binding matrix information",
      params: {
        binding_matrix_id: "ENSPFM0001",
        species: "homo_sapiens",
      },
    },
    {
      name: "Find protein features for insulin receptor",
      params: {
        protein_id: "ENSP00000303830",
        species: "homo_sapiens",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.getRegulatoryFeatures(test.params);

      if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} protein features`);
        if (result.length > 0) {
          const first = result[0];
          console.log(
            `   First result: ${first.display_name || first.id} (${
              first.feature_type || first.type || first.biotype
            })`
          );
          if (first.start && first.end) {
            console.log(`   Location: ${first.start}-${first.end}`);
          }
          if (result.length > 5) {
            console.log(`   Total features: ${result.length}`);
            console.log(
              `   Last result: ${
                result[result.length - 1].display_name ||
                result[result.length - 1].id
              }`
            );
          }
        }
      } else if (result) {
        console.log(`✅ Single result: ${result.display_name || result.id}`);
        if (result.description) {
          console.log(`   Description: ${result.description}`);
        }
      } else {
        console.log(`✅ Request successful (no results)`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting missing required parameters...");
    await client.getRegulatoryFeatures({
      species: "homo_sapiens",
      // Missing region, protein_id, and binding_matrix_id
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid protein ID...");
    await client.getRegulatoryFeatures({
      protein_id: "INVALID_PROTEIN_ID",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid binding matrix ID...");
    await client.getRegulatoryFeatures({
      binding_matrix_id: "INVALID_MATRIX",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testRegulatory().catch(console.error);
