import type { Metadata } from "next";
import { FormTarefa } from "@/components/FormTarefa";

export const metadata: Metadata = { title: "Nova tarefa" };

export default function PaginaNovaTarefa() {
  return <FormTarefa />;
}
