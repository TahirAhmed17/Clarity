import type { Metadata } from "next";
import { ReportUpload, WearableUpload } from "@/components/features/upload-forms";
import { PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Add data" };

export default function UploadPage() {
  return (
    <div>
      <PageHeader title="Add your data">
        Files are checked for type, size and content before anything is read. For the demo, use the synthetic files in the <code>samples/</code> folder.
      </PageHeader>
      <div className="grid gap-5">
        <ReportUpload />
        <WearableUpload />
      </div>
    </div>
  );
}
