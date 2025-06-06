#!/usr/bin/env node

/**
 * Test script for ensembl_compara tool
 * Tests comparative genomics: homology, gene trees, alignments
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.js";

const client = new EnsemblApiClient();

async function testCompara() {
  console.log("🔗 Testing ensembl_compara tool\n");

  const tests = [
    {
      name: "Find orthologs of human TP53",
      params: {
        gene_symbol: "TP53",
        analysis_type: "homology",
        species: "homo_sapiens",
        homology_type: "orthologues",
      },
    },
    {
      name: "Find paralogs of human BRCA1",
      params: {
        gene_id: "ENSG00000012048",
        analysis_type: "homology",
        species: "homo_sapiens",
        homology_type: "paralogues",
      },
    },
    {
      name: "Get homology for mouse Trp53",
      params: {
        gene_symbol: "Trp53",
        analysis_type: "homology",
        species: "mus_musculus",
        target_species: "homo_sapiens",
      },
    },
    {
      name: "Get gene tree for TP53",
      params: {
        gene_symbol: "TP53",
        analysis_type: "genetree",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get gene tree by Ensembl ID",
      params: {
        gene_id: "ENSG00000141510",
        analysis_type: "genetree",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get CAFE tree for evolutionary analysis",
      params: {
        gene_symbol: "EGFR",
        analysis_type: "cafe_tree",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get genomic alignment for TP53 region",
      params: {
        region: "17:7565096-7590856",
        analysis_type: "alignment",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get alignment with sequences",
      params: {
        region: "17:7570000-7580000",
        analysis_type: "alignment",
        species: "homo_sapiens",
        aligned: true,
      },
    },
    {
      name: "Find homologs in specific species",
      params: {
        gene_symbol: "BRCA1",
        analysis_type: "homology",
        species: "homo_sapiens",
        target_species: "mus_musculus",
      },
    },
    {
      name: "Get all homology relationships for EGFR",
      params: {
        gene_id: "ENSG00000146648",
        analysis_type: "homology",
        species: "homo_sapiens",
        homology_type: "all",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.getComparativeData(test.params);

      if (result.data && Array.isArray(result.data)) {
        const homologies = result.data;
        console.log(`✅ Found ${homologies.length} homology relationships`);

        if (homologies.length > 0) {
          const first = homologies[0];
          if (first.target) {
            console.log(
              `   First match: ${first.target.id} (${first.target.species}) - ${first.type}`
            );
            if (first.target.perc_id) {
              console.log(
                `   Identity: ${first.target.perc_id}%, Coverage: ${first.target.perc_pos}%`
              );
            }
          }

          // Count by species
          const speciesCount = {};
          homologies.forEach((h) => {
            if (h.target && h.target.species) {
              speciesCount[h.target.species] =
                (speciesCount[h.target.species] || 0) + 1;
            }
          });

          console.log(
            `   Species distribution:`,
            Object.entries(speciesCount)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([species, count]) => `${species}: ${count}`)
              .join(", ")
          );
        }
      } else if (result.tree) {
        console.log(`✅ Gene tree retrieved`);
        console.log(`   Tree ID: ${result.id || "N/A"}`);
        if (result.tree.length) {
          console.log(`   Tree structure: ${result.tree.substring(0, 100)}...`);
        }
      } else if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} alignment blocks`);
        if (result.length > 0) {
          const first = result[0];
          console.log(
            `   First block: ${first.seq_region}:${first.seq_region_start}-${first.seq_region_end}`
          );
          if (first.alignments) {
            console.log(`   Species in alignment: ${first.alignments.length}`);
          }
        }
      } else if (result) {
        console.log(
          `✅ Single result: ${JSON.stringify(result).substring(0, 100)}...`
        );
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting invalid gene symbol...");
    await client.getComparativeData({
      gene_symbol: "FAKEGENE123",
      analysis_type: "homology",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting missing required parameters...");
    await client.getComparativeData({
      analysis_type: "homology",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting alignment without region...");
    await client.getComparativeData({
      analysis_type: "alignment",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testCompara().catch(console.error);
