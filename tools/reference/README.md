# Golden-fixture dumper (development-time oracle)

`dump.go` is run **against a clone of the reference** to emit `fixtures/rng.json` and
`fixtures/transform.json`. The reference is a dev-time oracle only — no reference code
or data ships in the site.

## Regenerate fixtures

```sh
git clone --depth 1 https://github.com/Vilsol/timeless-jewels /tmp/tjref
mkdir -p /tmp/tjref/dump && cp tools/reference/dump.go /tmp/tjref/dump/main.go
cd /tmp/tjref && go run ./dump          # writes rng.json + transform.json
cp /tmp/tjref/rng.json /tmp/tjref/transform.json <repo>/fixtures/
```

Representative sample: 6 jewels × conquerors × {min, min+1, mid, max-1, max} seeds ×
~up-to-32 passives spanning keystone/notable/small-normal/small-attribute.
