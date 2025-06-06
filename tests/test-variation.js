#!/usr/bin/env node

/**
 * Test script for ensembl_variation tool
 * Tests variant analysis, VEP predictions, LD analysis, and phenotype mapping
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.ts";

const client = new EnsemblApiClient();

async function testVariation() {
  console.log("🧬 Testing ensembl_variation tool\n");

  const tests = [
    {
      name: "Get variant info for rs699 (AGT gene)",
      params: {
        variant_id: "rs699",
        analysis_type: "variant_info",
        species: "homo_sapiens",
      },
    },
    {
      name: "Get variant info for rs1800562 (HFE gene)",
      params: {
        variant_id: "rs1800562",
        analysis_type: "variant_info",
        species: "homo_sapiens",
      },
    },
    {
      name: "Find variants in TP53 region",
      params: {
        region: "17:7565096-7590856",
        analysis_type: "variant_info",
        species: "homo_sapiens",
      },
    },
    {
      name: "VEP analysis for rs699",
      params: {
        variant_id: "rs699",
        analysis_type: "vep",
        species: "homo_sapiens",
      },
    },
    {
      name: "VEP analysis with HGVS notation",
      params: {
        hgvs_notation: "ENST00000269305.4:c.215C>G",
        analysis_type: "vep",
        species: "homo_sapiens",
      },
    },
    {
      name: "VEP analysis by region",
      params: {
        region: "17:7676154-7676154:1/C",
        analysis_type: "vep",
        species: "homo_sapiens",
      },
    },
    {
      name: "Find missense variants in BRCA1",
      params: {
        region: "17:43000000-44000000",
        analysis_type: "variant_info",
        species: "homo_sapiens",
        consequence_type: "missense_variant",
      },
    },
    {
      name: "LD analysis for rs699",
      params: {
        variant_id: "rs699",
        analysis_type: "ld",
        species: "homo_sapiens",
        population: "1000GENOMES:phase_3:EUR",
      },
    },
    {
      name: "Get variation features by region",
      params: {
        region: "1:230710040-230710050",
        analysis_type: "variant_info",
        species: "homo_sapiens",
      },
    },
    {
      name: "Phenotype variants in diabetes region",
      params: {
        region: "17:43000000-44000000",
        analysis_type: "phenotype",
        species: "homo_sapiens",
      },
    },
    {
      name: "Transcript haplotypes for TP53",
      params: {
        transcript_id: "ENST00000269305",
        analysis_type: "haplotypes",
        species: "homo_sapiens",
      },
    },
    {
      name: "VEP for coding sequence variant",
      params: {
        hgvs_notation: "ENST00000269305.4:c.215C>G",
        analysis_type: "vep",
        species: "homo_sapiens",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.getVariationData(test.params);

      if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} results`);
        if (result.length > 0) {
          const first = result[0];

          // For VEP results
          if (first.most_severe_consequence) {
            console.log(
              `   Most severe consequence: ${first.most_severe_consequence}`
            );
          }
          if (first.transcript_consequences) {
            console.log(
              `   Transcript consequences: ${first.transcript_consequences.length}`
            );
            if (first.transcript_consequences.length > 0) {
              const tc = first.transcript_consequences[0];
              console.log(
                `   First consequence: ${
                  tc.consequence_terms?.join(", ") || "N/A"
                } in ${tc.transcript_id || "N/A"}`
              );
            }
          }

          // For variant results
          if (first.id) {
            console.log(`   Variant ID: ${first.id}`);
          }
          if (first.seq_region_name) {
            console.log(
              `   Location: ${first.seq_region_name}:${first.start}${
                first.end ? `-${first.end}` : ""
              }`
            );
          }
          if (first.alleles) {
            console.log(`   Alleles: ${first.alleles.join("/")}`);
          }
          if (first.minor_allele) {
            console.log(
              `   Minor allele: ${first.minor_allele} (freq: ${first.minor_allele_freq})`
            );
          }

          // For LD results
          if (first.r2 !== undefined) {
            console.log(`   LD r²: ${first.r2}, D': ${first.d_prime || "N/A"}`);
          }

          // For phenotype results
          if (first.phenotype) {
            console.log(`   Phenotype: ${first.phenotype}`);
          }
          if (first.study) {
            console.log(`   Study: ${first.study}`);
          }
        }
      } else if (result) {
        console.log(`✅ Single result:`);
        if (result.id) {
          console.log(`   Variant: ${result.id}`);
        }
        if (result.most_severe_consequence) {
          console.log(`   Most severe: ${result.most_severe_consequence}`);
        }
        if (result.transcript_consequences) {
          console.log(
            `   Transcript effects: ${result.transcript_consequences.length}`
          );
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting invalid variant ID...");
    await client.getVariationData({
      variant_id: "rs999999999999",
      analysis_type: "variant_info",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid HGVS notation...");
    await client.getVariationData({
      hgvs_notation: "INVALID:c.123A>G",
      analysis_type: "vep",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting LD without variant ID...");
    await client.getVariationData({
      analysis_type: "ld",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testVariation().catch(console.error);
