interface JsonLdProps {
  data: Record<string, unknown> | Record<string, unknown>[];
}

/** Embeds schema.org JSON-LD for generative-engine / search discoverability. */
export function JsonLd({ data }: JsonLdProps) {
  const graphs = Array.isArray(data) ? data : [data];
  return (
    <>
      {graphs.map((graph, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
        />
      ))}
    </>
  );
}
