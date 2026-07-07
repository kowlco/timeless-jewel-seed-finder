package main

import (
	"encoding/json"
	"os"
	"sort"

	"github.com/Vilsol/timeless-jewels/calculator"
	"github.com/Vilsol/timeless-jewels/data"
	"github.com/Vilsol/timeless-jewels/random"
)

type Add struct {
	Addition  uint32  `json:"addition"`
	StatRolls []int32 `json:"statRolls"`
}
type AltInfo struct {
	Skill     *uint32 `json:"skill"`
	StatRolls []int32 `json:"statRolls"`
	Additions []Add   `json:"additions"`
}
type TCase struct {
	PassiveID uint32  `json:"passiveId"`
	Seed      uint32  `json:"seed"`
	Jewel     uint32  `json:"jewel"`
	Conqueror string  `json:"conqueror"`
	Result    AltInfo `json:"result"`
}
type RCase struct {
	PassiveGraphID uint32   `json:"passiveGraphId"`
	Seed           uint32   `json:"seed"`
	Sequence       []uint32 `json:"sequence"`
}

func trim(r data.StatRolls, n int) []int32 {
	if n > 4 {
		n = 4
	}
	out := make([]int32, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, r[i])
	}
	return out
}
func serialize(r data.AlternatePassiveSkillInformation) AltInfo {
	ai := AltInfo{StatRolls: []int32{}, Additions: []Add{}}
	if r.AlternatePassiveSkill != nil {
		idx := r.AlternatePassiveSkill.Index
		ai.Skill = &idx
		ai.StatRolls = trim(r.StatRolls, len(r.AlternatePassiveSkill.StatsKeys))
	}
	for _, add := range r.AlternatePassiveAdditionInformations {
		if add.AlternatePassiveAddition == nil {
			continue
		}
		ai.Additions = append(ai.Additions, Add{
			Addition:  add.AlternatePassiveAddition.Index,
			StatRolls: trim(add.StatRolls, len(add.AlternatePassiveAddition.StatsKeys)),
		})
	}
	return ai
}

func seedsFor(jt data.JewelType) []uint32 {
	r := data.TimelessJewelSeedRanges[jt]
	step := uint32(1)
	if r.Special {
		step = 20
	}
	mid := (r.Min + r.Max) / 2
	mid -= mid % step
	return []uint32{r.Min, r.Min + step, mid, r.Max - step, r.Max}
}

func main() {
	applicable := data.GetApplicablePassives()
	sort.Slice(applicable, func(i, j int) bool { return applicable[i].Index < applicable[j].Index })
	buckets := map[data.PassiveSkillType][]*data.PassiveSkill{}
	for _, p := range applicable {
		t := data.GetPassiveSkillType(p)
		buckets[t] = append(buckets[t], p)
	}
	var sample []*data.PassiveSkill
	for _, t := range []data.PassiveSkillType{data.KeyStone, data.Notable, data.SmallNormal, data.SmallAttribute} {
		b := buckets[t]
		for i := 0; i < len(b) && i < 8; i++ {
			sample = append(sample, b[i])
		}
	}

	var tcases []TCase
	for jt := data.JewelType(1); jt <= 6; jt++ {
		conqs := data.TimelessJewelConquerors[jt]
		names := make([]string, 0, len(conqs))
		for name := range conqs {
			names = append(names, string(name))
		}
		sort.Strings(names)
		for _, name := range names {
			for _, seed := range seedsFor(jt) {
				for _, p := range sample {
					res := calculator.Calculate(p.Index, seed, jt, data.Conqueror(name))
					tcases = append(tcases, TCase{p.Index, seed, uint32(jt), name, serialize(res)})
				}
			}
		}
	}

	// RNG isolation cases via Glorious Vanity / Xibaqua (GetSeed == seed).
	atv := data.GetAlternateTreeVersionIndex(uint32(data.GloriousVanity))
	conq := data.TimelessJewelConquerors[data.GloriousVanity][data.Xibaqua]
	var rcases []RCase
	for _, p := range sample[:6] {
		for _, seed := range []uint32{100, 3571, 8000} {
			tj := data.TimelessJewel{Seed: seed, AlternateTreeVersion: atv, TimelessJewelConqueror: conq}
			var rng random.NumberGenerator
			rng.Reset(p, tj)
			seq := make([]uint32, 0, 8)
			for i := 0; i < 8; i++ {
				seq = append(seq, rng.GenerateUInt())
			}
			rcases = append(rcases, RCase{p.PassiveSkillGraphID, tj.GetSeed(), seq})
		}
	}

	write := func(path string, v any) {
		b, _ := json.MarshalIndent(v, "", " ")
		os.WriteFile(path, b, 0644)
	}
	write("transform.json", tcases)
	write("rng.json", rcases)
	println("transform cases:", len(tcases), "rng cases:", len(rcases))
}
