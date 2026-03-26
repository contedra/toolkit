import { defineCollection } from "astro:content";
import { contedraLoader } from "@contedra/astro-loader-firestore";

const projectId = process.env.FIRESTORE_PROJECT_ID ?? "demo-contedra";

const blogPosts = defineCollection({
  loader: contedraLoader({
    modelFile: "./models/blog_posts.json",
    firebaseConfig: { projectId },
  }),
});

const tags = defineCollection({
  loader: contedraLoader({
    modelFile: "./models/tags.json",
    firebaseConfig: { projectId },
  }),
});

export const collections = { blogPosts, tags };
