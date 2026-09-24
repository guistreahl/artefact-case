import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-12 text-center">
      <h1 className="page-title">Not found</h1>
      <p className="text-muted mt-3">This task does not exist or was already deleted.</p>
      <Link href="/" className="btn-primary mt-6">
        Back to the list
      </Link>
    </div>
  );
}
