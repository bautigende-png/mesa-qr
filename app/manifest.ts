import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mesa Lista",
    short_name: "Mesa Lista",
    description: "Asistente de mesa para llamar al mozo o pedir la cuenta",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f5ef",
    theme_color: "#f8f5ef",
    icons: []
  };
}
