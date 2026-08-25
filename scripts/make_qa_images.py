"""UltraQA: build adversarial OCR test images from the REAL NCERT chapter PDF.

Scenario sources (all real textbook pages, not synthetic):
  S1  jesc101.pdf page 1   — chapter opener w/ section headings (hostile: two-col, figures)
  S2  jesc101.pdf page 6   — dense text + numbered subsections
  S3  jemh101.pdf          — real maths chapter if fetch succeeds (variety)
Variants:
  a. 200dpi clean render            (best case)
  b. 110dpi JPEG q55 'phone photo'  (hostile: compression + low res)
"""
import pymupdf

OUT = r"C:/Users/Admin/AppData/Local/Temp"

def render(pdf, pno, tag):
    doc = pymupdf.open(pdf)
    if pno >= len(doc):
        print(f"skip {tag}: only {len(doc)} pages")
        return
    pix = doc[pno].get_pixmap(dpi=200)
    a = f"{OUT}/qa_{tag}_clean.png"
    pix.save(a)
    print("saved", a, f"{pix.width}x{pix.height}")
    pix2 = doc[pno].get_pixmap(dpi=110)
    b = f"{OUT}/qa_{tag}_lowres.png"
    pix2.save(b)
    # re-encode as jpeg for compression hostility
    from PIL import Image
    im = Image.open(b).convert("RGB")
    c = f"{OUT}/qa_{tag}_photo.jpg"
    im.save(c, "JPEG", quality=55)
    print("saved", c)

render(r"C:/Users/Admin/AppData/Local/Temp/jesc101.pdf", 0, "s1_ch1opener")
render(r"C:/Users/Admin/AppData/Local/Temp/jesc101.pdf", 5, "s2_dense")

# try the maths chapter via curl (urllib got connection-reset)
import subprocess
r = subprocess.run(["curl", "-sL", "--max-time", "60",
                    "-o", f"{OUT}/jemh101.pdf",
                    "https://ncert.nic.in/textbook/pdf/jemh101.pdf"],
                   capture_output=True, text=True)
print("maths curl:", r.returncode)
try:
    render(f"{OUT}/jemh101.pdf", 0, "s3_maths")
except Exception as e:
    print("maths render failed:", e)
