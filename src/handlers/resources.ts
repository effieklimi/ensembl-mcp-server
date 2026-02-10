import { ensemblClient } from "./tools.js";
import { logger } from "../utils/logger.js";
import { EnsemblError } from "../utils/error-handler.js";

export const ensemblResources = [
  {
    uri: "ensembl://species",
    name: "Species List",
    description:
      "Complete list of species available in the current Ensembl release, with taxonomy and assembly info.",
    mimeType: "application/json",
  },
  {
    uri: "ensembl://releases",
    name: "Release Info",
    description:
      "Current Ensembl data and REST API release versions.",
    mimeType: "application/json",
  },
];

export const ensemblResourceTemplates = [
  {
    uriTemplate: "ensembl://assembly/{species}",
    name: "Assembly Info",
    description:
      "Genome assembly details (chromosomes, coordinate system, top-level regions) for a given species.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "ensembl://biotypes/{species}",
    name: "Biotypes",
    description:
      "List of gene/transcript biotypes available for a given species.",
    mimeType: "application/json",
  },
];

export async function handleReadResource(uri: string) {
  logger.info("resource_read", { uri });

  // ensembl://species
  if (uri === "ensembl://species") {
    const data = await ensemblClient.getAllSpecies();
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data),
        },
      ],
    };
  }

  // ensembl://releases
  if (uri === "ensembl://releases") {
    const [dataRelease, restRelease] = await Promise.all([
      ensemblClient.getMetaInfo({ info_type: "data" }),
      ensemblClient.getMetaInfo({ info_type: "rest" }),
    ]);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ data: dataRelease, rest: restRelease }),
        },
      ],
    };
  }

  // ensembl://assembly/{species}
  const assemblyMatch = uri.match(/^ensembl:\/\/assembly\/(.+)$/);
  if (assemblyMatch) {
    const species = assemblyMatch[1]!;
    const data = await ensemblClient.getAssemblyInfo(species);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data),
        },
      ],
    };
  }

  // ensembl://biotypes/{species}
  const biotypesMatch = uri.match(/^ensembl:\/\/biotypes\/(.+)$/);
  if (biotypesMatch) {
    const species = biotypesMatch[1]!;
    const data = await ensemblClient.getMetaInfo({
      info_type: "biotypes",
      species,
    });
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data),
        },
      ],
    };
  }

  throw new EnsemblError(
    `Unknown resource URI: ${uri}`,
    404,
    uri,
    "Available resources: ensembl://species, ensembl://releases, ensembl://assembly/{species}, ensembl://biotypes/{species}"
  );
}
