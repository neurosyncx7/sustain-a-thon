import { NextResponse } from "next/server";
import { readJson } from "@/lib/data";

// Status of every algorithm designed for the problem, generated from logged test results.
export async function GET() {
  return NextResponse.json(await readJson("inventory/algorithms.json"));
}
