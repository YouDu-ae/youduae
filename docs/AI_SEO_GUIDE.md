# YouDu AI SEO Guide

This document defines internal standards for AI-optimized content and technical SEO across the YouDu project.

---

## Table of Contents

1. [Entity Definitions](#entity-definitions)
2. [Writing Standards](#writing-standards)
3. [Schema.org Requirements](#schemaorg-requirements)
4. [Page Templates](#page-templates)
5. [Metadata Standards](#metadata-standards)
6. [Content Checklist](#content-checklist)
7. [AI Search Optimization](#ai-search-optimization)

---

## Entity Definitions

### Primary Entities

Always use consistent terminology when referring to these entities:

| Entity | Definition | Never Use |
|--------|------------|-----------|
| **YouDu** | A technology marketplace that connects customers with verified service professionals in the UAE | YouDu.ae, Youdu, YOUDU, the platform |
| **Customer** | A person seeking home services through YouDu | Client, user, buyer |
| **Service Professional** | A verified individual or company providing services through YouDu | Provider, vendor, seller, contractor |
| **Task** | A service request posted by a customer | Job, project, request, order |
| **Offer** | A response from a professional to a customer's task | Bid, quote, proposal |

### Entity Relationships

```
YouDu (Organization)
├── Founded by: Alexander Gross (Person)
├── Located in: Dubai, UAE (Place)
├── Industry: Home Services Marketplace (Category)
├── Serves: Customers (Audience)
└── Connects with: Service Professionals (Providers)
```

---

## Writing Standards

### Tone of Voice

- **Professional** — Expert but approachable
- **Clear** — No jargon or marketing fluff
- **Factual** — State facts, not opinions
- **Helpful** — Focus on user benefit

### AI-Optimized Writing Rules

1. **Start with definitions**
   ```
   ✓ "YouDu is a technology marketplace that connects customers with verified service professionals."
   ✗ "Welcome to the best platform for finding amazing professionals!"
   ```

2. **Introduce entities before pronouns**
   ```
   ✓ "YouDu verifies all professionals. The platform requires documentation..."
   ✗ "We verify all professionals. It requires documentation..."
   ```

3. **Use explicit language**
   ```
   ✓ "YouDu operates in Dubai, Abu Dhabi, and Sharjah."
   ✗ "We operate in major cities."
   ```

4. **Avoid ambiguity**
   ```
   ✓ "Customers can choose professionals based on reviews, ratings, and pricing."
   ✗ "Users can choose based on various factors."
   ```

5. **Use consistent terminology**
   - Always "service professional" not "provider/vendor/seller"
   - Always "customer" not "client/user/buyer"
   - Always "task" not "job/project/request"

### Content Structure

Every major section should follow this pattern:

1. **Definition** — What is it?
2. **Purpose** — Why does it exist?
3. **Process** — How does it work?
4. **Benefit** — What value does it provide?

---

## Schema.org Requirements

### Required Schema Types

#### 1. Organization (site-wide)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "YouDu",
  "legalName": "YouDu UAE",
  "url": "https://youdu.ae",
  "logo": "https://youdu.ae/logo.png",
  "description": "YouDu is a technology marketplace that connects customers with verified service professionals across the United Arab Emirates.",
  "founder": {
    "@type": "Person",
    "name": "Alexander Gross"
  },
  "foundingDate": "2024",
  "areaServed": {
    "@type": "Country",
    "name": "United Arab Emirates"
  },
  "serviceType": "Home Services Marketplace"
}
```

#### 2. WebSite (site-wide)
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "YouDu",
  "url": "https://youdu.ae",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://youdu.ae/s?keywords={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
```

#### 3. Service (for each service category)
```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "Plumbing Services",
  "description": "Find verified plumbers in UAE through YouDu marketplace.",
  "provider": {
    "@type": "Organization",
    "name": "YouDu"
  },
  "areaServed": {
    "@type": "Country",
    "name": "United Arab Emirates"
  },
  "serviceType": "Plumbing"
}
```

#### 4. FAQPage (for FAQ sections)
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is YouDu?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "YouDu is a technology marketplace that connects customers with verified service professionals across the United Arab Emirates."
      }
    }
  ]
}
```

#### 5. BreadcrumbList (for navigation)
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://youdu.ae"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Services",
      "item": "https://youdu.ae/services"
    }
  ]
}
```

### Schema Validation

- All schema must pass [Google Rich Results Test](https://search.google.com/test/rich-results)
- All schema must pass [Schema.org Validator](https://validator.schema.org/)
- No warnings allowed in production

---

## Page Templates

### Landing Page Template

```html
<main>
  <!-- 1. Hero with clear definition -->
  <section>
    <h1>[Service Name] in UAE | YouDu</h1>
    <p>YouDu connects customers with verified [service] professionals across the United Arab Emirates.</p>
  </section>

  <!-- 2. How it works -->
  <section>
    <h2>How YouDu Works</h2>
    <!-- Step-by-step process -->
  </section>

  <!-- 3. Service categories -->
  <section>
    <h2>[Service] Categories</h2>
    <!-- List of subcategories -->
  </section>

  <!-- 4. Trust signals -->
  <section>
    <h2>Why Choose YouDu</h2>
    <!-- Verification, reviews, etc. -->
  </section>

  <!-- 5. FAQ -->
  <section>
    <h2>Frequently Asked Questions</h2>
    <!-- FAQ with schema markup -->
  </section>
</main>
```

### Service Category Page Template

```html
<main>
  <!-- 1. Clear definition -->
  <h1>[Category] Services in UAE</h1>
  <p>Find verified [category] professionals through YouDu, the UAE's trusted home services marketplace.</p>

  <!-- 2. Available tasks/professionals -->
  <section>
    <h2>Available [Category] Tasks</h2>
    <!-- Task listings -->
  </section>

  <!-- 3. Subcategories -->
  <section>
    <h2>[Category] Subcategories</h2>
    <!-- List with descriptions -->
  </section>

  <!-- 4. Location-specific -->
  <section>
    <h2>[Category] Services by Location</h2>
    <!-- Dubai, Abu Dhabi, etc. -->
  </section>
</main>
```

---

## Metadata Standards

### Title Tag Formula

```
[Primary Keyword] in UAE | YouDu - [Value Proposition]
```

Examples:
- `Plumbing Services in UAE | YouDu - Verified Professionals`
- `Find Electricians in Dubai | YouDu - Trusted Home Services`

### Meta Description Formula

```
[Definition]. [Benefit]. [Call to action].
```

Example:
```
YouDu connects customers with verified plumbers across UAE. Compare prices, read reviews, and hire trusted professionals. Post your task today.
```

### Character Limits

| Element | Limit |
|---------|-------|
| Title | 50-60 characters |
| Meta Description | 150-160 characters |
| H1 | 60 characters max |
| URL slug | 50 characters max |

### Required Meta Tags

```html
<title>[Title]</title>
<meta name="description" content="[Description]">
<meta name="robots" content="index, follow">
<link rel="canonical" href="[Canonical URL]">

<!-- Open Graph -->
<meta property="og:title" content="[Title]">
<meta property="og:description" content="[Description]">
<meta property="og:image" content="https://youdu.ae/og-banner.png">
<meta property="og:url" content="[URL]">
<meta property="og:type" content="website">
<meta property="og:site_name" content="YouDu">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="[Title]">
<meta name="twitter:description" content="[Description]">
<meta name="twitter:image" content="https://youdu.ae/og-banner.png">
```

---

## Content Checklist

### Before Publishing Any Page

- [ ] Page starts with a clear definition
- [ ] All entities are introduced before using pronouns
- [ ] Terminology matches entity definitions
- [ ] No marketing fluff or superlatives
- [ ] Schema.org markup is complete and valid
- [ ] Meta tags follow standards
- [ ] Internal links use descriptive anchor text
- [ ] Images have descriptive alt text
- [ ] FAQ section included where relevant
- [ ] Mobile-friendly layout

### AI Readability Check

- [ ] Can AI answer "What is this page about?" from the first paragraph?
- [ ] Are all claims factual and verifiable?
- [ ] Is the content structure logical and hierarchical?
- [ ] Are there clear answers to common questions?

---

## AI Search Optimization

### Optimizing for AI Systems

| AI System | Optimization Focus |
|-----------|-------------------|
| **Google AI Overview** | Structured data, clear definitions, FAQ markup |
| **ChatGPT/OpenAI** | Factual content, entity relationships, clear explanations |
| **Gemini** | Schema.org, knowledge graph connections |
| **Claude** | Well-structured content, logical flow |
| **Perplexity** | Citations, authoritative language, facts |
| **Copilot** | Clear answers, structured data |
| **Yandex Alice** | Russian content optimization, local relevance |

### Key Questions Every Important Page Must Answer

1. **What is YouDu?** — Clear definition in first paragraph
2. **Who is YouDu for?** — Target audience clearly stated
3. **How does YouDu work?** — Step-by-step process
4. **How is YouDu different?** — Unique value proposition
5. **Why trust YouDu?** — Trust signals and verification
6. **What services are available?** — Service catalog
7. **Where does YouDu operate?** — Geographic coverage

### Content That AI Systems Prefer

1. **Definitions over descriptions**
   - Lead with "X is..." not "Welcome to..."

2. **Facts over opinions**
   - "YouDu verifies all professionals" not "YouDu has the best professionals"

3. **Structure over prose**
   - Use headings, lists, tables
   - Break complex topics into sections

4. **Explicit over implicit**
   - State relationships clearly
   - Don't assume context

5. **Consistent over creative**
   - Use the same terms throughout
   - Maintain consistent structure

---

## Development Workflow

### After Every Code Change

1. Re-evaluate SEO impact
2. Validate Schema.org markup
3. Check metadata completeness
4. Review internal linking
5. Test AI readability

### Monthly AI SEO Audit

1. Check Google Search Console for AI Overview appearances
2. Test key queries in ChatGPT, Perplexity, Gemini
3. Validate all structured data
4. Review and update FAQ sections
5. Analyze competitor AI visibility

---

## Resources

- [Schema.org Documentation](https://schema.org)
- [Google Search Central](https://developers.google.com/search)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Schema Validator](https://validator.schema.org/)

---

*This guide should be consulted before creating or modifying any content on YouDu.*
