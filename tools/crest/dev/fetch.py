"""Download the pictures the sigils are traced from, as large renders from
   Wikimedia Commons' own renderer (its file server often refuses scripts).
   python3 fetch.py <folder>
   Wikimedia asks scripts to say who they are: set TSI_CONTACT to an email or
   web address before running. One picture at a time, waiting when told to."""
import os, sys, time, urllib.parse, urllib.request, urllib.error
here = os.path.dirname(os.path.abspath(__file__))
folder = sys.argv[1]
os.makedirs(folder, exist_ok=True)
ua = 'TSI-MasterSuite-crest-tools/1.0 (personal D&D tool; %s)' % os.environ.get('TSI_CONTACT', 'no contact given')
for line in open(os.path.join(here, 'sigils.tsv'), encoding='utf-8'):
    if line.startswith('#') or not line.strip():
        continue
    sid, name, width, _ = line.rstrip('\n').split('\t')
    out = os.path.join(folder, name[:-4] + '.png')
    if os.path.exists(out):
        continue
    url = 'https://commons.wikimedia.org/w/thumb.php?f=%s&width=%s' % (urllib.parse.quote(name), width)
    wait = 20
    for attempt in range(10):
        try:
            data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': ua}), timeout=60).read()
            if not data.startswith(b'\x89PNG'):
                raise urllib.error.HTTPError(url, 429, 'not a picture', {}, None)
            open(out, 'wb').write(data)
            print('got', name)
            break
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503):
                sys.exit('failed %s: HTTP %s' % (name, e.code))
            ra = e.headers.get('Retry-After') if e.headers else None
            print('asked to wait', ra or wait, 'seconds')
            time.sleep(int(ra) if ra and ra.isdigit() else wait)
            wait = min(wait * 2, 300)
    time.sleep(8)
