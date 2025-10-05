# import pandas as pd, json, sys

# csv_in = sys.argv[1] if len(sys.argv) > 1 else "Drink List - wine_list.csv"
# json_out = sys.argv[2] if len(sys.argv) > 2 else "menu.json"

# df = pd.read_csv(csv_in)

# # Normalize columns
# df.columns = [c.strip().lower() for c in df.columns]
# df.rename(columns={
#     'glass price': 'glass_price',
#     'bottle price': 'bottle_price'
# }, inplace=True)

# for c in ['glass_price', 'bottle_price']:
#     if c in df.columns:
#         df[c] = pd.to_numeric(df[c], errors='coerce')

# def norm_cat(x):
#     if not isinstance(x, str):
#         return ""
#     x_low = x.strip().lower()
#     if x_low in ["happy hour"]:
#         return "happy hour"
#     if x_low in ["wine"]:
#         return "wine"
#     if x_low in ["cocktail", "cocktails"]:
#         return "cocktails"
#     if x_low in ["mocktails", "mocktail"]:
#         return "mocktails"
#     if x_low in ["after dinner wine", "after-dinner wine", "after dinner wines"]:
#         return "after-dinner wine"
#     if x_low in ["after dinner martinis", "after-dinner martinis", "after dinner martini"]:
#         return "after-dinner martinis"
#     return x_low

# if 'category' in df.columns:
#     df['category_norm'] = df['category'].apply(norm_cat)
# else:
#     df['category_norm'] = ""

# records = []
# for _, r in df.iterrows():
#     rec = {
#         "id": (None if 'id' not in r or pd.isna(r['id']) else str(r['id'])),
#         "name": ("" if 'name' not in r or pd.isna(r['name']) else str(r['name']).strip()),
#         "grape": (None if 'grape' not in r or pd.isna(r['grape']) else str(r['grape']).strip()),
#         "glass_price": (None if 'glass_price' not in r or pd.isna(r['glass_price']) else float(r['glass_price'])),
#         "bottle_price": (None if 'bottle_price' not in r or pd.isna(r['bottle_price']) else float(r['bottle_price'])),
#         "category": (None if 'category' not in r or pd.isna(r['category']) else str(r['category']).strip()),
#         "category_norm": r['category_norm']
#     }
#     records.append(rec)

# with open(json_out, "w") as f:
#     json.dump(records, f, indent=2)

# print(f"Wrote {json_out} from {csv_in} with {len(records)} rows.")
