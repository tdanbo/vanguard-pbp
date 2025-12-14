# 6.5 Final Polish

**Skill**: `shadcn-react`

## Goal

Final integration testing and polish before design system is complete.

---

## Overview

This task covers:
- Full user journey testing
- Cross-browser compatibility
- Performance audit
- Final visual polish

---

## User Journey Testing

Walk through complete user flows:

### New User Flow

1. [ ] Land on home page
2. [ ] Register new account
3. [ ] Verify email (if applicable)
4. [ ] Login
5. [ ] See empty campaigns list
6. [ ] Create first campaign
7. [ ] See campaign dashboard
8. [ ] Create first scene
9. [ ] Navigate to scene view

### Player Flow

1. [ ] Join campaign via invite link
2. [ ] Create character
3. [ ] Navigate to scene
4. [ ] View posts
5. [ ] Acquire compose lock
6. [ ] Write and submit post
7. [ ] View notification
8. [ ] Pass turn

### GM Flow

1. [ ] Create campaign
2. [ ] Configure settings
3. [ ] Create characters (NPCs)
4. [ ] Create scenes
5. [ ] Transition phases
6. [ ] Request dice rolls
7. [ ] Resolve/override rolls
8. [ ] Manage members

---

## Cross-Browser Testing

Test on these browsers:

### Desktop

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Mobile

- [ ] iOS Safari
- [ ] Android Chrome

### Check For

- CSS rendering differences
- Font rendering
- Backdrop blur support
- Flexbox/Grid layout issues
- Focus state visibility

---

## Performance Audit

### Lighthouse Audit

Run Lighthouse in Chrome DevTools:

- [ ] Performance score > 90
- [ ] Accessibility score > 90
- [ ] Best Practices score > 90
- [ ] SEO score > 90

### Common Issues

**Large images**: Ensure scene headers are optimized
```tsx
// Use appropriate image sizes
<img
  src={imageUrl}
  loading="lazy"
  decoding="async"
/>
```

**Unnecessary re-renders**: Check React DevTools Profiler

**Large bundles**: Check build output
```bash
bun run build
# Check dist folder sizes
```

---

## Visual Polish Checklist

### Typography

- [ ] Font-display loads correctly
- [ ] Scene titles use serif + shadow
- [ ] Character names are gold
- [ ] Body text is readable
- [ ] Line heights comfortable

### Colors

- [ ] Background is warm charcoal (not blue)
- [ ] Gold accent consistent
- [ ] Phase colors correct
- [ ] Contrast meets WCAG

### Spacing

- [ ] Consistent padding in cards
- [ ] Comfortable margins between sections
- [ ] Nothing cramped or sparse

### Interactions

- [ ] Hover states visible
- [ ] Active states correct
- [ ] Focus states visible
- [ ] Loading states show
- [ ] Error states display

### Empty States

- [ ] Thematic messaging
- [ ] Action buttons present
- [ ] Consistent styling

---

## Edge Cases

### Long Content

- [ ] Long campaign names truncate
- [ ] Long character names truncate
- [ ] Long post content wraps correctly
- [ ] Long scene descriptions truncate

### Many Items

- [ ] 50+ posts scroll smoothly
- [ ] 20+ characters display
- [ ] 10+ scenes in grid

### Error States

- [ ] Network errors show message
- [ ] Form validation errors display
- [ ] 404 page works
- [ ] Auth errors redirect to login

---

## Final Checklist

### Foundation

- [ ] Warm gold/charcoal theme active
- [ ] Custom fonts loading
- [ ] Dark mode is default
- [ ] All utility classes work

### Components

- [ ] Buttons use gold accent
- [ ] Cards lift on hover
- [ ] Badges show all states
- [ ] Forms validate correctly

### Views

- [ ] Campaign dashboard tabs work
- [ ] Scene view is immersive
- [ ] Composer fixed at bottom
- [ ] Roster shows pass states

### Features

- [ ] Dice rolling complete
- [ ] Phase transitions work
- [ ] Notifications display
- [ ] Images upload correctly

### Accessibility

- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Contrast passes
- [ ] Motion reduced when requested

### Responsive

- [ ] Mobile views work
- [ ] Touch targets adequate
- [ ] No horizontal scroll

---

## Sign-Off

Design system implementation is complete when:

1. All checklist items pass
2. No visual regressions
3. All user flows work
4. Performance acceptable
5. Accessibility compliant

---

## Next Steps

After design implementation:

1. **Document patterns**: Update component documentation
2. **Create storybook**: If desired, add Storybook for components
3. **Monitor**: Watch for issues in production
4. **Iterate**: Refine based on user feedback
