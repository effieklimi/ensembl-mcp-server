#!/usr/bin/env node

/**
 * Test script for ensembl_regulatory tool
 * Tests regulatory features, binding matrices, and regulatory annotations
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.js";

const client = new EnsemblApiClient();

async function testRegulatory() {
  console.log("🔬 Testing ensembl_regulatory tool\n");

  const tests = [
    {
      name: "Find regulatory features in BRCA1 promoter region",
      params: {
        region: "17:43044295-43045802",
        species: "homo_sapiens",
        feature_type: "RegulatoryFeature",
      },
    },
    {
      name: "Find all regulatory elements in TP53 region",
      params: {
        region: "17:7565096-7590856",
        species: "homo_sapiens",
      },
    },
    {
      name: "Find motif features in enhancer region",
      params: {
        region: "17:43000000-43010000",
        species: "homo_sapiens",
        feature_type: "MotifFeature",
      },
    },
    {
      name: "Find regulatory features affecting EGFR protein",
      params: {
        protein_id: "ENSP00000275493",
        species: "homo_sapiens",
      },
    },
    {
      name: "Find regulatory features for TP53 protein",
      params: {
        protein_id: "ENSP00000269305",
        species: "homo_sapiens",
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
      name: "Find regulatory features in mouse Sox2 region",
      params: {
        region: "3:34547775-34551693",
        species: "mus_musculus",
        feature_type: "RegulatoryFeature",
      },
    },
    {
      name: "Find transcription factor binding sites",
      params: {
        region: "1:1000000-1010000",
        species: "homo_sapiens",
        feature_type: "TF_binding_site",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.getRegulatoryFeatures(test.params);

      if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} regulatory features`);
        if (result.length > 0) {
          const first = result[0];
          console.log(
            `   First result: ${first.display_name || first.id} (${
              first.feature_type || first.biotype
            })`
          );
          if (first.bound_start && first.bound_end) {
            console.log(
              `   Location: ${first.seq_region_name}:${first.bound_start}-${first.bound_end}`
            );
          }
          if (result.length > 1) {
            console.log(`   Total regulatory elements: ${result.length}`);
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
