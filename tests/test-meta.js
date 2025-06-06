#!/usr/bin/env node

/**
 * Test script for ensembl_meta tool
 * Tests server metadata, species info, assemblies, and diagnostics
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.js";

const client = new EnsemblApiClient();

async function testMeta() {
  console.log("📊 Testing ensembl_meta tool\n");

  const tests = [
    {
      name: "Get server info and status",
      params: {
        info_type: "rest",
      },
    },
    {
      name: "Check server ping",
      params: {
        info_type: "ping",
      },
    },
    {
      name: "Get software versions",
      params: {
        info_type: "software",
      },
    },
    {
      name: "Get available species list",
      params: {
        info_type: "species",
      },
    },
    {
      name: "Get genome information for human",
      params: {
        info_type: "genomes",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get assembly info for human",
      params: {
        info_type: "assembly",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get biotypes for human",
      params: {
        info_type: "biotypes",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get available analyses",
      params: {
        info_type: "analysis",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get variation info for human",
      params: {
        info_type: "variation",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get division info",
      params: {
        info_type: "division",
      },
    },
    {
      name: "Archive ID version lookup",
      params: {
        info_type: "archive",
        identifier: "ENSG00000141510",
      },
    },
    {
      name: "Get mouse genome info",
      params: {
        info_type: "genomes",
        species: "mus_musculus",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.getMetaInfo(test.params);

      if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} items`);

        if (result.length > 0) {
          const first = result[0];

          // Species list
          if (first.name && first.display_name) {
            console.log(
              `   First species: ${first.display_name} (${first.name})`
            );
            if (first.assembly) {
              console.log(`   Assembly: ${first.assembly}`);
            }
            console.log(`   Total species: ${result.length}`);
          }

          // Biotypes
          if (first.biotype) {
            console.log(
              `   First biotype: ${first.biotype} (${first.object_type})`
            );
            console.log(`   Total biotypes: ${result.length}`);
          }

          // Analyses
          if (first.logic_name) {
            console.log(`   First analysis: ${first.logic_name}`);
            if (first.description) {
              console.log(
                `   Description: ${first.description.substring(0, 80)}...`
              );
            }
            console.log(`   Total analyses: ${result.length}`);
          }
        }
      } else if (result) {
        console.log(`✅ Retrieved metadata:`);

        // Server info
        if (result.ping) {
          console.log(
            `   Server status: ${result.ping === 1 ? "OK" : "ERROR"}`
          );
        }

        if (result.version) {
          console.log(`   API version: ${result.version}`);
        }

        if (result.release) {
          console.log(`   Ensembl release: ${result.release}`);
        }

        // Software info
        if (result.perl_version) {
          console.log(`   Perl version: ${result.perl_version}`);
        }

        if (result.ensembl_version) {
          console.log(`   Ensembl version: ${result.ensembl_version}`);
        }

        // Assembly info
        if (result.assembly_name) {
          console.log(`   Assembly: ${result.assembly_name}`);
        }

        if (result.assembly_date) {
          console.log(`   Assembly date: ${result.assembly_date}`);
        }

        if (result.genebuild) {
          console.log(`   Gene build: ${result.genebuild}`);
        }

        // Variation info
        if (result.variation_sources) {
          console.log(
            `   Variation sources: ${result.variation_sources.length}`
          );
        }

        // Archive info
        if (result.id) {
          console.log(`   ID: ${result.id}`);
          if (result.latest) {
            console.log(`   Latest: ${result.latest ? "Yes" : "No"}`);
          }
          if (result.release) {
            console.log(`   Release: ${result.release}`);
          }
        }

        // Generic object display
        if (!result.ping && !result.assembly_name && !result.id) {
          const keys = Object.keys(result).slice(0, 5);
          console.log(`   Keys: ${keys.join(", ")}`);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting invalid species...");
    await client.getMetaInfo({
      info_type: "assembly",
      species: "invalid_species",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid info type...");
    await client.getMetaInfo({
      info_type: "invalid_info_type",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting archive without identifier...");
    await client.getMetaInfo({
      info_type: "archive",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testMeta().catch(console.error);
