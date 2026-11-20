import tools from "../../../../../packages/tool-registry/tools.json";
import { Tool } from "../../../components/tool";
import { WorkflowBuilder } from "../../../components/workflow";
import { notFound } from "next/navigation";
export const dynamicParams = false;
export function generateStaticParams() {
  return tools.map((t) => ({ slug: t.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = tools.find((t) => t.id === slug);
  return {
    title: t?.name,
    description: t?.description,
    alternates: { canonical: `tools/${slug}/` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tool = tools.find((t) => t.id === slug);
  if (!tool) notFound();
  return tool.id === "pdf-workflow-builder" ? (
    <WorkflowBuilder />
  ) : (
    <Tool tool={tool} />
  );
}
