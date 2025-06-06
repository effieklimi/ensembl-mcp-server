#!/usr/bin/env node

/**
 * Test script for ensembl_protein_features tool
 * Tests protein domain annotations and functional features
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.js";

const client = new EnsemblApiClient();

async function testProteinFeatures() {
  console.log("🧬 Testing ensembl_protein_features tool\n");

  const tests = [
    {
      name: "Get protein features for TP53",
      params: {
        protein_id: "ENSP00000269305",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get protein features for BRCA1",
      params: {
        protein_id: "ENSP00000350283",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get protein features for EGFR",
      params: {
        protein_id: "ENSP00000275493",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get specific domain types (Pfam)",
      params: {
        protein_id: "ENSP00000269305",
        species: "homo_sapiens",
        feature_type: "Pfam",
      },
    },
    {
      name: "Get InterPro domains",
      params: {
        protein_id: "ENSP00000350283",
        species: "homo_sapiens",
        feature_type: "InterPro",
      },
    },
    {
      name: "Get SMART domains for EGFR",
      params: {
        protein_id: "ENSP00000275493",
        species: "homo_sapiens",
        feature_type: "SMART",
      },
    },
    {
      name: "Get protein features for mouse Trp53",
      params: {
        protein_id: "ENSMUSP00000057573",
        species: "mus_musculus",
      },
    },
    {
      name: "Get transmembrane domains",
      params: {
        protein_id: "ENSP00000275493",
        species: "homo_sapiens",
        feature_type: "tmhelix",
      },
    },
    {
      name: "Get protein features for insulin receptor",
      params: {
        protein_id: "ENSP00000303830",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get coiled coil regions",
      params: {
        protein_id: "ENSP00000269305",
        species: "homo_sapiens",
        feature_type: "coiled_coil",
      },
    },
    {
      name: "Get low complexity regions",
      params: {
        protein_id: "ENSP00000350283",
        species: "homo_sapiens",
        feature_type: "low_complexity",
      },
    },
    {
      name: "Get signal peptides",
      params: {
        protein_id: "ENSP00000275493",
        species: "homo_sapiens",
        feature_type: "sig_p",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.getProteinFeatures(test.params);

      if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} protein features`);

        if (result.length > 0) {
          const first = result[0];
          console.log(
            `   First feature: ${
              first.description || first.interpro_ac || first.id
            }`
          );

          if (first.start && first.end) {
            console.log(
              `   Location: ${first.start}-${first.end} (${
                first.end - first.start + 1
              } aa)`
            );
          }

          if (first.type) {
            console.log(`   Feature type: ${first.type}`);
          }

          if (first.interpro_ac) {
            console.log(`   InterPro: ${first.interpro_ac}`);
          }

          if (first.dbname) {
            console.log(`   Database: ${first.dbname}`);
          }

          // Group by feature type
          const typeCount = {};
          result.forEach((f) => {
            const type = f.type || f.dbname || "unknown";
            typeCount[type] = (typeCount[type] || 0) + 1;
          });

          console.log(
            `   Feature distribution:`,
            Object.entries(typeCount)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([type, count]) => `${type}: ${count}`)
              .join(", ")
          );
        }
      } else if (result) {
        console.log(`✅ Single protein feature:`);
        console.log(`   ${result.description || result.id}`);
        if (result.start && result.end) {
          console.log(`   Position: ${result.start}-${result.end}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting invalid protein ID...");
    await client.getProteinFeatures({
      protein_id: "INVALID_PROTEIN_ID",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting missing protein ID...");
    await client.getProteinFeatures({
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid species...");
    await client.getProteinFeatures({
      protein_id: "ENSP00000269305",
      species: "invalid_species",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testProteinFeatures().catch(console.error);
