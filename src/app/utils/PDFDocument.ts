import PDFDocument from "pdfkit";

interface InvoiceData {
  patientName: string;
  patientEmail: string;
  appointmentId: string;
  trxId: string;
  amount: number | string;
  date: string;
  joiningTime: string;
  serialNumber: number;
}

export const generateInvoicePdf = (data: InvoiceData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", (err) => reject(err));

    // Header Title
    doc.fontSize(20).text("PH Healthcare System", { align: "center" });
    doc.fontSize(12).text("Payment Invoice & Appointment Summary", { align: "center" });
    doc.moveDown(2);

    // Invoice Meta
    doc.fontSize(10).text(`Invoice ID: INV-${data.appointmentId.slice(-6).toUpperCase()}`);
    doc.text(`Date: ${data.date}`);
    doc.text(`Transaction ID: ${data.trxId}`);
    doc.moveDown();

    // Line Divider
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Patient & Appointment Details
    doc.fontSize(12).text("Patient & Appointment Details:", { underline: true });
    doc.fontSize(10).moveDown(0.5);
    doc.text(`Patient Name : ${data.patientName}`);
    doc.text(`Email        : ${data.patientEmail}`);
    doc.text(`Serial No    : #${data.serialNumber}`);
    doc.text(`Joining Time : ${data.joiningTime}`);
    doc.moveDown();

    // Payment Summary Table/Box
    doc.rect(50, doc.y, 500, 40).stroke();
    doc.text(`Amount Paid: BDT ${data.amount}`, 60, doc.y - 25, { bold: true } as any);
    doc.text(`Payment Status: PAID (bKash)`, 350, doc.y - 12);
    
    doc.moveDown(3);
    doc.fontSize(10).text("Thank you for choosing PH Healthcare!", { align: "center" });

    // Finalize PDF
    doc.end();
  });
};