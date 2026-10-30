/** Read API errors safely, including Vercel's non-JSON 413/504 responses. */
export async function readUploadApiJson<T extends { ok?: boolean; message?: string }>(
  response: Response
): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  let data: T | null = null;
  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(body) as T;
    } catch {
      data = null;
    }
  }
  if (response.ok && data?.ok !== false && data) return data;
  if (response.status === 413) {
    throw new Error("파일 또는 전송 데이터가 서버 한도를 초과했습니다. 파일을 더 작게 나누거나 재선택해 주세요.");
  }
  if (response.status === 504 || response.status === 408) {
    throw new Error("요청 시간이 초과되었습니다. 파일 크기와 네트워크를 확인한 뒤 다시 시도해 주세요.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(data?.message ?? "로그인 권한을 확인해 주세요.");
  }
  if (data?.message) throw new Error(data.message);
  throw new Error("서버 응답 오류 (HTTP " + response.status + "). 관리자에게 오류 코드를 전달해 주세요.");
}
