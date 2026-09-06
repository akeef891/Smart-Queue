import QRCode from "qrcode";

export async function QueueJoinQr({ joinUrl }: { joinUrl: string }) {
  const dataUrl = await QRCode.toDataURL(joinUrl, {
    width: 256,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return (
    <section className="mt-6 rounded-xl border bg-white p-6">
      <h3 className="text-base font-semibold">Scan to Join</h3>
      <p className="mt-1 text-sm text-slate-500">
        Customers can scan this QR code to open the join page for this queue.
      </p>
      <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <img
          src={dataUrl}
          alt="QR code to join this queue"
          width={256}
          height={256}
          className="h-56 w-56 rounded-md border bg-white p-2"
        />
        <p className="break-all text-xs text-slate-500">{joinUrl}</p>
      </div>
    </section>
  );
}
