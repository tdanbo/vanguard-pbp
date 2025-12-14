// Package dice provides dice rolling functionality with system presets.
package dice

// dnd5eIntentions provides the default intentions for D&D 5th Edition.
//
//nolint:gochecknoglobals // Package-level slice for preset configuration
var dnd5eIntentions = []string{
	"Attack",
	"Damage",
	"Saving Throw",
	"Ability Check",
	"Initiative",
	"Death Save",
	"Skill Check",
	"Spell Attack",
}

// DND5eDiceType is the default dice type for D&D 5e.
const DND5eDiceType = "d20"

// pf2eIntentions provides the default intentions for Pathfinder 2nd Edition.
//
//nolint:gochecknoglobals // Package-level slice for preset configuration
var pf2eIntentions = []string{
	"Strike",
	"Damage",
	"Saving Throw",
	"Skill Check",
	"Perception Check",
	"Initiative",
	"Flat Check",
	"Spell Attack",
}

// PF2eDiceType is the default dice type for Pathfinder 2e.
const PF2eDiceType = "d20"

// SystemPreset represents a dice system configuration.
type SystemPreset struct {
	Name       string   `json:"name"`
	Intentions []string `json:"intentions"`
	DiceType   string   `json:"diceType"`
}

// GetAvailablePresets returns all available system presets.
func GetAvailablePresets() []SystemPreset {
	return []SystemPreset{
		{
			Name:       "dnd5e",
			Intentions: dnd5eIntentions,
			DiceType:   DND5eDiceType,
		},
		{
			Name:       "pf2e",
			Intentions: pf2eIntentions,
			DiceType:   PF2eDiceType,
		},
		{
			Name:       "custom",
			Intentions: []string{}, // User-defined
			DiceType:   "d20",      // User-configurable
		},
	}
}

// GetPresetByName returns a preset by name, or nil if not found.
func GetPresetByName(name string) *SystemPreset {
	presets := GetAvailablePresets()
	for _, p := range presets {
		if p.Name == name {
			return &p
		}
	}
	return nil
}

// ValidDiceTypes returns all supported dice types.
func ValidDiceTypes() []string {
	return []string{"d4", "d6", "d8", "d10", "d12", "d20", "d100"}
}

// IsValidDiceType checks if a dice type is valid.
func IsValidDiceType(diceType string) bool {
	for _, dt := range ValidDiceTypes() {
		if dt == diceType {
			return true
		}
	}
	return false
}
