import InfluencerFormClient from "@/components/admin/InfluencerFormClient";

export default async function EditInfluencerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InfluencerFormClient mode="edit" influencerId={id} />;
}
