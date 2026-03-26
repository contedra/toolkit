import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const projectId = process.env.FIRESTORE_PROJECT_ID ?? "demo-contedra";

const app = initializeApp({
  projectId,
});

const db = getFirestore(app);

async function seed() {
  console.log(`Seeding Firestore (project: ${projectId})...`);

  // Seed tags
  const tags: Record<string, { name: string; slug: string }> = {
    "tag-astro": { name: "Astro", slug: "astro" },
    "tag-firebase": { name: "Firebase", slug: "firebase" },
    "tag-typescript": { name: "TypeScript", slug: "typescript" },
  };

  for (const [id, data] of Object.entries(tags)) {
    await db.collection("tags").doc(id).set(data);
    console.log(`  tags/${id}`);
  }

  // Seed blog posts
  const posts: Record<
    string,
    { title: string; content: string; publishedAt: Timestamp; tags: string[] }
  > = {
    "getting-started-with-astro": {
      title: "Getting Started with Astro",
      content: [
        "# Getting Started with Astro",
        "",
        "Astro is a modern web framework for building fast, content-driven websites.",
        "",
        "## Why Astro?",
        "",
        "- **Fast by default** — Zero JS shipped to the browser",
        "- **Content-focused** — Built for content-rich websites",
        "- **Island architecture** — Interactive components only where needed",
      ].join("\n"),
      publishedAt: Timestamp.fromDate(new Date("2024-01-15T09:00:00Z")),
      tags: ["tag-astro", "tag-typescript"],
    },
    "firebase-for-content-management": {
      title: "Using Firebase for Content Management",
      content: [
        "# Using Firebase for Content Management",
        "",
        "Firebase Firestore is a great choice for managing content with Conteditor.",
        "",
        "## Benefits",
        "",
        "1. Real-time updates",
        "2. Flexible schema",
        "3. Scalable infrastructure",
        "",
        "```typescript",
        'import { getFirestore } from "firebase-admin/firestore";',
        "const db = getFirestore();",
        "```",
      ].join("\n"),
      publishedAt: Timestamp.fromDate(new Date("2024-02-20T14:30:00Z")),
      tags: ["tag-firebase", "tag-typescript"],
    },
    "astro-meets-firestore": {
      title: "Astro Meets Firestore: Building a CMS-Powered Blog",
      content: [
        "# Astro Meets Firestore",
        "",
        "Combine Astro's Content Layer API with Firestore for a powerful CMS experience.",
        "",
        "## The Stack",
        "",
        "- **Astro** for the frontend",
        "- **Firestore** for the data layer",
        "- **@contedra/astro-loader-firestore** to bridge the two",
        "",
        "This loader makes it seamless to use Conteditor-managed content in Astro.",
      ].join("\n"),
      publishedAt: Timestamp.fromDate(new Date("2024-03-10T10:00:00Z")),
      tags: ["tag-astro", "tag-firebase"],
    },
  };

  for (const [id, data] of Object.entries(posts)) {
    await db.collection("blog_posts").doc(id).set(data);
    console.log(`  blog_posts/${id}`);
  }

  console.log("Seeding complete!");
}

seed().catch(console.error);
