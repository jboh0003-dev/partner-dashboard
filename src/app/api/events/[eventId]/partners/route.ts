import { NextResponse } from "next/server";
import {
  createEventPartnerLink,
  deleteEventPartnerLink,
  fetchEventPartnerLinks
} from "@/lib/data/event-partners";

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await context.params;
  const { links, error } = await fetchEventPartnerLinks(eventId);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ links });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;
    const body = (await request.json()) as {
      partnerId?: string;
      relationType?: string;
      note?: string | null;
    };

    if (!body.partnerId?.trim()) {
      return NextResponse.json({ error: "파트너를 선택해 주세요." }, { status: 400 });
    }

    const { link, error } = await createEventPartnerLink({
      eventId,
      partnerId: body.partnerId.trim(),
      relationType: body.relationType?.trim() || "관련",
      note: body.note ?? null
    });

    if (error || !link) {
      return NextResponse.json({ error: error ?? "연결 저장에 실패했습니다." }, { status: 400 });
    }

    const { links } = await fetchEventPartnerLinks(eventId);
    const created = links.find((item) => item.id === link.id);

    return NextResponse.json({ ok: true, link: created ?? link });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "연결 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await context.params;
  const linkId = new URL(request.url).searchParams.get("linkId");

  if (!linkId) {
    return NextResponse.json({ error: "linkId가 필요합니다." }, { status: 400 });
  }

  const { error } = await deleteEventPartnerLink(linkId);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId, linkId });
}
