import pdfplumber
import re


def normalize(text):
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip().upper())


def find_number_key(value):
    """
    Extract numeric part from FIND NUMBER safely.
    Examples:
    '10.' -> 10
    '10'  -> 10
    '10A' -> 10
    """
    if not value:
        return 0
    match = re.search(r"\d+", str(value))
    return int(match.group()) if match else 0


def parse_bom_pdf(pdf_path: str):
    """
    Accurate BOM parser using TABLE-FIRST approach.
    Extracts:
      - FIND NUMBER
      - PART DESCRIPTION
    """

    items = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()

            for table in tables:
                if not table or len(table) < 2:
                    continue

                headers = [normalize(h) for h in table[0]]

                if "FIND NUMBER" not in headers or "PART DESCRIPTION" not in headers:
                    continue

                find_idx = headers.index("FIND NUMBER")
                desc_idx = headers.index("PART DESCRIPTION")

                for row in table[1:]:
                    if not row or len(row) <= max(find_idx, desc_idx):
                        continue

                    find_no = row[find_idx]
                    desc = row[desc_idx]

                    if not find_no or not desc:
                        continue

                    find_no = str(find_no).strip()
                    desc = re.sub(r"\s+", " ", desc.strip())

                    # Deduplicate by find number
                    items[find_no] = desc

    # Convert to sorted list (robust against '10.', '10A', etc.)
    return [
        {
            "find_number": k,
            "part_description": v
        }
        for k, v in sorted(items.items(), key=lambda x: find_number_key(x[0]))
    ]
