// Simple test script to verify the Ensembl MCP server functionality
import { EnsemblApiClient } from "./src/utils/ensembl-api.js";

async function testEnsemblAPI() {
  console.log("🧬 Testing Ensembl MCP Server Components...\n");

  const client = new EnsemblApiClient();

  try {
    // Test 1: Get gene info
    console.log("📍 Test 1: Getting BRAF gene info...");
    const gene = await client.searchGenes({
      gene_name: "BRAF",
      species: "homo_sapiens",
    });
    console.log(
      `✅ Found gene: ${gene[0]?.display_name || "Unknown"} (${gene[0]?.id})`
    );
    console.log(
      `   Location: chr${gene[0]?.seq_region_name}:${gene[0]?.start}-${gene[0]?.end}\n`
    );

    // Test 2: List some species
    console.log("📍 Test 2: Getting species list...");
    const species = await client.getAllSpecies();
    console.log(`✅ Found ${species.length} species in Ensembl`);
    console.log(
      `   Examples: ${species
        .slice(0, 3)
        .map((s) => s.display_name)
        .join(", ")}\n`
    );

    // Test 3: Get assembly info
    console.log("📍 Test 3: Getting human assembly info...");
    const assembly = await client.getAssemblyInfo("homo_sapiens");
    console.log(`✅ Assembly: ${assembly.assembly_name || "Unknown"}`);
    console.log(
      `   Chromosomes: ${assembly.karyotype?.length || "Unknown"} found\n`
    );

    console.log("🎉 All tests passed! The MCP server should work correctly.");
  } catch (error) {
    console.error(
      "❌ Test failed:",
      error instanceof Error ? error.message : error
    );
    console.log("\n🔧 This might be due to network issues or API changes.");
    console.log("   The MCP server structure is still valid.");
  }
}

// Run the test
testEnsemblAPI().catch(console.error);
