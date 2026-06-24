import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import path from "path";
import os from "os";

const scannerPath = path.resolve(process.cwd(), "../index.js");

// GET — scan by path
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("path") || process.cwd();

  try {
    const result = execSync(`node "${scannerPath}" "${target}" --json`, {
      encoding: "utf8", timeout: 30000,
    });
    return NextResponse.json(JSON.parse(result));
  } catch (e: any) {
    try { return NextResponse.json(JSON.parse(e.stdout)); } catch {
      return NextResponse.json({ error: e.message, findings: [] });
    }
  }
}

// POST — upload folder, scan, return results
export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const dirName = formData.get("dirname") as string || "uploaded-project";

  if (!files.length) {
    return NextResponse.json({ error: "No files uploaded", findings: [] }, { status: 400 });
  }

  // Save uploaded files to temp directory
  const tmpDir = path.join(os.tmpdir(), `ai-config-guard-${Date.now()}`, dirName);
  mkdirSync(tmpDir, { recursive: true });

  try {
    for (const file of files) {
      const relativePath = (file as any).relativePath || file.name;
      // Handle paths from webkitdirectory (e.g. "project-folder/src/app.js")
      const parts = relativePath.split('/');
      if (parts.length > 1) parts.shift(); // remove top-level folder name
      const filePath = path.join(tmpDir, parts.join('/'));
      mkdirSync(path.dirname(filePath), { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      writeFileSync(filePath, buffer);
    }

    // Run scanner on temp directory
    let result: any;
    try {
      const output = execSync(`node "${scannerPath}" "${tmpDir}" --json`, {
        encoding: "utf8", timeout: 30000,
      });
      result = JSON.parse(output);
    } catch (e: any) {
      try { result = JSON.parse(e.stdout); } catch {
        result = { error: e.message, findings: [] };
      }
    }

    // Override path to show original folder name
    result.path = dirName;
    return NextResponse.json(result);
  } finally {
    // Cleanup temp files after scan
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}
