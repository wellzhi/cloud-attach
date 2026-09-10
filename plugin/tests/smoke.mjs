import assert from "node:assert/strict";
import crypto from "node:crypto";

function normalizeRegion(region) { return String(region || "").trim().toLowerCase().replace(/^oss-/, ""); }
function normalizePrefix(prefix) { return String(prefix || "").trim().replace(/^\/+|\/+$/g, ""); }
function encodeOssComponent(value) { return encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`); }
function canonical(method, bucket, key, headers) {
  const names = Object.keys(headers).map(x => x.toLowerCase()).filter(x => x === "content-type" || x === "content-md5" || x.startsWith("x-oss-")).sort();
  const canonicalHeaders = names.map(name => `${name}:${headers[name].trim()}\n`).join("");
  const uri = encodeOssComponent(`/${bucket}/${key}`).replace(/%2F/gi, "/");
  return [method.toUpperCase(), uri, "", canonicalHeaders, "", "UNSIGNED-PAYLOAD"].join("\n");
}

assert.equal(normalizeRegion("oss-cn-guangzhou"), "cn-guangzhou");
assert.equal(normalizePrefix("/public/"), "public");
assert.equal(encodeOssComponent("a b!*"), "a%20b%21%2A");
const req = canonical("PUT", "examplebucket", "exampleobject", {
  "content-type": "text/plain",
  "x-oss-content-sha256": "UNSIGNED-PAYLOAD",
  "x-oss-date": "20250411T064124Z"
});
assert.ok(req.startsWith("PUT\n/examplebucket/exampleobject\n\ncontent-type:text/plain\n"));
assert.ok(req.includes("x-oss-content-sha256:UNSIGNED-PAYLOAD\n"));
assert.ok(req.endsWith("\n\nUNSIGNED-PAYLOAD"));
const key = crypto.createHmac("sha256", "aliyun_v4secret").update("20250411").digest();
assert.equal(key.length, 32);
console.log("smoke tests passed");
