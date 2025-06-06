#!/usr/bin/env node

/**
 * Test script for ensembl_feature_overlap tool
 * Tests genomic feature overlap queries - exactly how an LLM would call them
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.ts";

const client = new EnsemblApiClient();

async function testFeatureOverlap() {
  console.log("🧬 Testing ensembl_feature_overlap tool\n");

  const tests = [
    {
      name: "Find genes in BRCA1 region (chr17)",
      params: {
        region: "17:43000000-44000000",
        species: "homo_sapiens",
        feature_types: ["gene"],
      },
    },
    {
      name: "Find genes in TP53 region",
      params: {
        region: "17:7565096-7590856",
        species: "homo_sapiens",
        feature_types: ["gene"],
      },
    },
    {
      name: "Find protein-coding genes in chr1 region",
      params: {
        region: "1:1000000-2000000",
        species: "homo_sapiens",
        feature_types: ["gene"],
        biotype: "protein_coding",
      },
    },
    {
      name: "Find overlapping features for EGFR gene",
      params: {
        feature_id: "ENSG00000146648",
        species: "homo_sapiens",
        feature_types: ["transcript"],
      },
    },
    {
      name: "Find mouse genes in Trp53 region",
      params: {
        region: "11:69580359-69591873",
        species: "mus_musculus",
        feature_types: ["gene"],
      },
    },
    {
      name: "Find transcripts in enhancer region",
      params: {
        region: "17:43000000-43010000",
        species: "homo_sapiens",
        feature_types: ["transcript"],
      },
    },
    {
      name: "Find variations in disease-associated region",
      params: {
        region: "17:7571720-7590856",
        species: "homo_sapiens",
        feature_types: ["variation"],
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = test.params.feature_id
        ? await client.getOverlapById(test.params)
        : await client.getOverlapByRegion(test.params);

      if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} overlapping features`);
        if (result.length > 0) {
          console.log(
            `   First result: ${result[0].display_name || result[0].id} (${
              result[0].biotype || result[0].feature_type
            })`
          );
          if (result.length > 1) {
            console.log(
              `   Last result: ${
                result[result.length - 1].display_name ||
                result[result.length - 1].id
              }`
            );
          }
        }
      } else {
        console.log(`✅ Single result: ${result.display_name || result.id}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting invalid region format...");
    await client.getOverlapByRegion({
      region: "invalid-region",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid species...");
    await client.getOverlapByRegion({
      region: "1:1000000-2000000",
      species: "invalid_species",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testFeatureOverlap().catch(console.error);
