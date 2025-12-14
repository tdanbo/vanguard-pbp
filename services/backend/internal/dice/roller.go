package dice

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
)

// Dice side constants for standard RPG dice.
const (
	D4Sides   = 4
	D6Sides   = 6
	D8Sides   = 8
	D10Sides  = 10
	D12Sides  = 12
	D20Sides  = 20
	D100Sides = 100
)

// Validation constants.
const (
	MaxDiceCount = 100
	MaxModifier  = 100
	MinModifier  = -100
)

// Roller handles cryptographically secure dice rolling.
type Roller struct{}

// NewRoller creates a new dice roller.
func NewRoller() *Roller {
	return &Roller{}
}

// Roll rolls N dice of given type (e.g., "d20").
// Returns array of individual results and error.
func (r *Roller) Roll(diceType string, count int) ([]int32, error) {
	if count < 1 || count > MaxDiceCount {
		return nil, fmt.Errorf("dice count must be 1-100, got %d", count)
	}

	sides, err := ParseDiceType(diceType)
	if err != nil {
		return nil, err
	}

	results := make([]int32, count)
	for i := range count {
		result, rollErr := rollSingleDie(sides)
		if rollErr != nil {
			return nil, rollErr
		}
		//nolint:gosec // result is always 1..sides, well within int32 range
		results[i] = int32(result)
	}

	return results, nil
}

// rollSingleDie rolls a single die with N sides using crypto/rand.
func rollSingleDie(sides int) (int, error) {
	var buf [8]byte
	_, err := rand.Read(buf[:])
	if err != nil {
		return 0, fmt.Errorf("failed to generate random number: %w", err)
	}

	// Convert to uint64
	randomValue := binary.BigEndian.Uint64(buf[:])

	// Map to 1..sides range (inclusive)
	//nolint:gosec // sides is always positive and small (max 100)
	result := int(randomValue%uint64(sides)) + 1

	return result, nil
}

// ParseDiceType converts a dice type string to number of sides.
func ParseDiceType(diceType string) (int, error) {
	switch diceType {
	case "d4":
		return D4Sides, nil
	case "d6":
		return D6Sides, nil
	case "d8":
		return D8Sides, nil
	case "d10":
		return D10Sides, nil
	case "d12":
		return D12Sides, nil
	case "d20":
		return D20Sides, nil
	case "d100":
		return D100Sides, nil
	default:
		return 0, fmt.Errorf("invalid dice type: %s", diceType)
	}
}

// CalculateTotal sums dice results and adds modifier.
func (r *Roller) CalculateTotal(diceResults []int32, modifier int) int {
	total := modifier
	for _, result := range diceResults {
		total += int(result)
	}
	return total
}

// ValidateModifier checks if a modifier is within valid range.
func ValidateModifier(modifier int) error {
	if modifier < MinModifier || modifier > MaxModifier {
		return fmt.Errorf("modifier must be between %d and +%d, got %d", MinModifier, MaxModifier, modifier)
	}
	return nil
}

// ValidateDiceCount checks if dice count is within valid range.
func ValidateDiceCount(count int) error {
	if count < 1 || count > MaxDiceCount {
		return fmt.Errorf("dice count must be between 1 and %d, got %d", MaxDiceCount, count)
	}
	return nil
}
