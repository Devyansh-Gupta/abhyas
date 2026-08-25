"""Render real NCERT textbook pages (contents/index) to PNG for adversarial OCR QA."""
import pymupdf

pdf_path = r"C:/Users/Admin/AppData/Local/Temp/jesc101.pdf"
doc = pymupdf.open(pdf_path)
print("pages:", len(doc))

# Find the Contents page (usually page 2-6 of NCERT books)
for pno in range(1, 8):
    text = doc[pno].get_text()
    if "CONTENTS" in text.upper() or "Contents" in text:
        print(f"CONTENTS found on pdf page {pno}")
        pix = doc[pno].get_pixmap(dpi=200)
        out = r"C:/Users/Admin/AppData/Local/Temp/qa_contents_page.png"
        pix.save(out)
        print("saved", out, pix.width, "x", pix.height)
        # also save a lower-quality version (hostile: photo-like compression)
        pix2 = doc[pno].get_pixmap(dpi=110)
        out2 = r"C:/Users/Admin/AppData/Local/Temp/qa_contents_lowres.png"
        pix2.save(out2, jpg_quality=55)
        print("saved", out2, pix2.width, "x", pix2.height)
        break
else:
    # dump first 8 pages' first lines to locate contents manually
    for pno in range(0, 8):
        t = doc[pno].get_text()[:150].replace("\n", " | ")
        print(pno, ":", t)
