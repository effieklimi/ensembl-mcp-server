#!/usr/bin/env node

/**
 * Test script for ensembl_mapping tool
 * Tests coordinate transformations between genomic, cDNA, CDS, and protein coordinates
 */

import { EnsemblApiClient } from "../src/utils/ensembl-api.ts";

const client = new EnsemblApiClient();

async function testMapping() {
  console.log("🗺️ Testing ensembl_mapping tool\n");

  const tests = [
    {
      name: "Map genomic to cDNA coordinates (TP53)",
      params: {
        feature_id: "ENST00000269305",
        mapping_type: "cdna",
        coordinates: "100..200",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map genomic to CDS coordinates (BRCA1)",
      params: {
        feature_id: "ENST00000357654",
        mapping_type: "cds",
        coordinates: "1..100",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map genomic coordinates for EGFR cDNA",
      params: {
        feature_id: "ENST00000275493",
        mapping_type: "cdna",
        coordinates: "1..100",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map assembly coordinates (GRCh37 to GRCh38)",
      params: {
        mapping_type: "assembly",
        source_assembly: "GRCh37",
        target_assembly: "GRCh38",
        coordinates: "17:7512445..7531642",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map cDNA coordinates for TP53",
      params: {
        feature_id: "ENST00000269305",
        mapping_type: "cdna",
        coordinates: "1..100",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map BRCA1 cDNA coordinates",
      params: {
        feature_id: "ENST00000357654",
        mapping_type: "cdna",
        coordinates: "200..300",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map CDS coordinates for TP53",
      params: {
        feature_id: "ENST00000269305",
        mapping_type: "cds",
        coordinates: "1..50",
        species: "homo_sapiens",
      },
    },
    {
      name: "Map mouse coordinates (Trp53)",
      params: {
        feature_id: "ENSMUST00000108658",
        mapping_type: "cdna",
        coordinates: "1..100",
        species: "mus_musculus",
      },
    },
    {
      name: "Assembly mapping with different coordinates",
      params: {
        mapping_type: "assembly",
        source_assembly: "GRCh37",
        target_assembly: "GRCh38",
        coordinates: "1:1000000..2000000",
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
    console.log("\nTesting invalid feature ID...");
    await client.mapCoordinates({
      feature_id: "INVALID_TRANSCRIPT",
      mapping_type: "cdna",
      coordinates: "1..100",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }

  try {
    console.log("\nTesting invalid coordinate format...");
    await client.mapCoordinates({
      feature_id: "ENST00000269305",
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
      source_assembly: "INVALID_ASSEMBLY",
      target_assembly: "GRCh38",
      coordinates: "17:7512445..7531642",
      species: "homo_sapiens",
    });
  } catch (error) {
    console.log(`✅ Correctly caught error: ${error.message}`);
  }
}

// Run the tests
testMapping().catch(console.error);
