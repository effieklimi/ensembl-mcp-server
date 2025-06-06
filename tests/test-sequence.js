#!/usr/bin/env node

/**
 * Test script for ensembl_sequence tool
 * Tests DNA, RNA, and protein sequence retrieval
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.ts";

const client = new EnsemblApiClient();

async function testSequence() {
  console.log("🧬 Testing ensembl_sequence tool\n");

  const tests = [
    {
      name: "Get genomic sequence for BRCA1 gene",
      params: {
        identifier: "ENSG00000012048",
        sequence_type: "genomic",
        species: "homo_sapiens",
        format: "json",
      },
    },
    {
      name: "Get cDNA sequence for TP53 transcript",
      params: {
        identifier: "ENST00000269305",
        sequence_type: "cdna",
        species: "homo_sapiens",
        format: "fasta",
      },
    },
    {
      name: "Get CDS sequence for EGFR transcript",
      params: {
        identifier: "ENST00000275493",
        sequence_type: "cds",
        species: "homo_sapiens",
        format: "json",
      },
    },
    {
      name: "Get protein sequence for TP53",
      params: {
        identifier: "ENSP00000269305",
        sequence_type: "protein",
        species: "homo_sapiens",
        format: "fasta",
      },
    },
    {
      name: "Get genomic region sequence (TP53 locus)",
      params: {
        identifier: "17:7565096-7590856",
        sequence_type: "genomic",
        species: "homo_sapiens",
        format: "json",
      },
    },
    {
      name: "Get sequence with soft masking (repeats lowercase)",
      params: {
        identifier: "17:7565096-7570000",
        sequence_type: "genomic",
        species: "homo_sapiens",
        format: "json",
        mask: "soft",
      },
    },
    {
      name: "Get sequence with hard masking (repeats as N)",
      params: {
        identifier: "17:7565096-7570000",
        sequence_type: "genomic",
        species: "homo_sapiens",
        format: "json",
        mask: "hard",
      },
    },
    {
      name: "Get mouse Trp53 genomic sequence",
      params: {
        identifier: "ENSMUSG00000059552",
        sequence_type: "genomic",
        species: "mus_musculus",
        format: "fasta",
      },
    },
    {
      name: "Get small genomic region for promoter analysis",
      params: {
        identifier: "17:43044295-43045802",
        sequence_type: "genomic",
        species: "homo_sapiens",
        format: "fasta",
      },
    },
    {
      name: "Get transcript genomic sequence",
      params: {
        identifier: "ENST00000269305",
        sequence_type: "genomic",
        species: "homo_sapiens",
        format: "json",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.getSequenceData(test.params);

      if (result) {
        if (result.seq) {
          const seqLength = result.seq.length;
          console.log(`✅ Retrieved sequence of ${seqLength} bp/aa`);
          console.log(`   ID: ${result.id || result.desc || "N/A"}`);
          console.log(
            `   Type: ${result.molecule || test.params.sequence_type}`
          );

          // Show first and last 20 characters of sequence
          if (seqLength > 40) {
            console.log(
              `   Sequence: ${result.seq.substring(
                0,
                20
              )}...${result.seq.substring(seqLength - 20)}`
            );
          } else {
            console.log(`   Sequence: ${result.seq}`);
          }

          // Check for soft masking (lowercase)
          const lowercaseCount = (result.seq.match(/[a-z]/g) || []).length;
          if (lowercaseCount > 0) {
            console.log(
              `   Soft masked bases: ${lowercaseCount}/${seqLength} (${(
                (lowercaseCount / seqLength) *
                100
              ).toFixed(1)}%)`
            );
          }

          // Check for hard masking (N's)
          const nCount = (result.seq.match(/N/g) || []).length;
          if (nCount > 0) {
            console.log(
              `   Hard masked bases: ${nCount}/${seqLength} (${(
                (nCount / seqLength) *
                100
              ).toFixed(1)}%)`
            );
          }
        } else {
          console.log(
            `✅ Request successful: ${JSON.stringify(result).substring(
              0,
              100
            )}...`
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
    console.log("\nTesting invalid identifier...");
    await client.getSequenceData({
      identifier: "INVALID_ID",
      sequence_type: "genomic",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid region format...");
    await client.getSequenceData({
      identifier: "chr17:invalid-region",
      sequence_type: "genomic",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting protein sequence for genomic region...");
    const result = await client.getSequenceData({
      identifier: "17:7565096-7590856",
      sequence_type: "protein",
      species: "homo_sapiens",
    });
    console.log(
      `✅ API returns DNA sequence when protein requested for region: ${result.molecule} (${result.seq.length} bp)`
    );
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testSequence().catch(console.error);
