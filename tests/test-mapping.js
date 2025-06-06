#!/usr/bin/env node

/**
 * Test script for ensembl_mapping tool
 * Tests coordinate transformations between genomic, cDNA, CDS, and protein coordinates
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.js";

const client = new EnsemblApiClient();

async function testMapping() {
  console.log("🗺️ Testing ensembl_mapping tool\n");

  const tests = [
    {
      name: "Map genomic to cDNA coordinates (TP53)",
      params: {
        transcript_id: "ENST00000269305",
        mapping_type: "cdna",
        coordinates: "17:7579372..7579700",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map genomic to CDS coordinates (BRCA1)",
      params: {
        transcript_id: "ENST00000357654",
        mapping_type: "cds",
        coordinates: "17:43045677..43045802",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map genomic to protein coordinates (EGFR)",
      params: {
        transcript_id: "ENST00000275493",
        mapping_type: "translation",
        coordinates: "7:55019021..55019120",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map assembly coordinates (GRCh37 to GRCh38)",
      params: {
        mapping_type: "assembly",
        from_assembly: "GRCh37",
        to_assembly: "GRCh38",
        region: "17:7512445..7531642",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map cDNA position to genomic",
      params: {
        transcript_id: "ENST00000269305",
        mapping_type: "cdna_to_genomic",
        coordinates: "100..200",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map protein position to genomic",
      params: {
        transcript_id: "ENST00000269305",
        mapping_type: "protein_to_genomic",
        coordinates: "50..60",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map CDS position to genomic",
      params: {
        transcript_id: "ENST00000269305",
        mapping_type: "cds_to_genomic",
        coordinates: "150..300",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map mouse coordinates (Trp53)",
      params: {
        transcript_id: "ENSMUST00000108658",
        mapping_type: "cdna",
        coordinates: "11:69580359..69591873",
        species: "mus_musculus",
      },
    },
    {
      name: "Map small region to protein",
      params: {
        transcript_id: "ENST00000357654",
        mapping_type: "translation",
        coordinates: "17:43045677..43045679",
        species: "homo_sapiens",
      },
    },
    {
      name: "Assembly lift between human builds",
      params: {
        mapping_type: "assembly",
        from_assembly: "NCBI36",
        to_assembly: "GRCh38",
        region: "17:7512445..7531642",
        species: "homo_sapiens",
      },
    },
  ];

  for (const test of tests) {
    try {
      console.log(`\n📍 ${test.name}`);
      console.log(`Parameters:`, JSON.stringify(test.params, null, 2));

      const result = await client.mapCoordinates(test.params);

      if (result.mappings && Array.isArray(result.mappings)) {
        console.log(`✅ Found ${result.mappings.length} coordinate mappings`);

        if (result.mappings.length > 0) {
          const first = result.mappings[0];

          if (first.mapped) {
            if (first.mapped.seq_region_name) {
              console.log(
                `   Mapped to: ${first.mapped.seq_region_name}:${first.mapped.start}-${first.mapped.end}`
              );
            }
            if (first.mapped.rank) {
              console.log(`   Rank: ${first.mapped.rank}`);
            }
            if (first.mapped.coord_system) {
              console.log(`   Coordinate system: ${first.mapped.coord_system}`);
            }
          }

          if (first.original) {
            console.log(
              `   Original: ${first.original.seq_region_name}:${first.original.start}-${first.original.end}`
            );
          }

          // For assembly mappings
          if (first.assembly_name) {
            console.log(`   Target assembly: ${first.assembly_name}`);
          }
        }
      } else if (Array.isArray(result)) {
        console.log(`✅ Found ${result.length} mappings`);

        if (result.length > 0) {
          const first = result[0];
          console.log(
            `   First mapping: ${first.seq_region_name}:${first.start}-${first.end}`
          );
          if (first.strand) {
            console.log(`   Strand: ${first.strand > 0 ? "+" : "-"}`);
          }
        }
      } else if (result) {
        console.log(`✅ Mapping result:`);
        console.log(`   ${JSON.stringify(result).substring(0, 150)}...`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }

  // Test error handling
  console.log("\n🚫 Testing error conditions:");

  try {
    console.log("\nTesting invalid transcript ID...");
    await client.mapCoordinates({
      transcript_id: "INVALID_TRANSCRIPT",
      mapping_type: "cdna",
      coordinates: "17:7579372..7579700",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid coordinate format...");
    await client.mapCoordinates({
      transcript_id: "ENST00000269305",
      mapping_type: "cdna",
      coordinates: "invalid-coordinates",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid assembly...");
    await client.mapCoordinates({
      mapping_type: "assembly",
      from_assembly: "INVALID_ASSEMBLY",
      to_assembly: "GRCh38",
      region: "17:7512445..7531642",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testMapping().catch(console.error);
