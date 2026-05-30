import {
  TS_TYPES,
  JAVA_TYPES,
  hasNonDefaultAnns,
  toSnakeUpper,
} from "./parser.js";

// ════════════════════════════════════════════════
//  SYNTAX HIGHLIGHTING (High-Performance Engine)
// ════════════════════════════════════════════════
export function hl(code) {
  // Escape HTML first
  code = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Placeholder uses LETTER-only keys (no digits) → number-highlight regex can never collide.
  // Key encoding: base-26 letters only, e.g. 0→'a', 25→'z', 26→'ba', 51→'bz', 52→'ca' …
  const MARK = "\uE000";
  const spans = [];
  function toKey(n) {
    let s = '';
    do { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  }
  const keyOf = [];           // pre-built cache so we don't recompute per restore
  function save(html) {
    const key = toKey(spans.length);
    keyOf.push(key);
    spans.push(html);
    return `${MARK}${key}${MARK}`;
  }

  // Order matters: longer/more-specific patterns first

  // 1. Full import lines  e.g.  import java.time.LocalDateTime;
  code = code.replace(
    /\b(import )([\w.]+)(;)/g,
    (_, kw, pkg, sc) =>
      save(`<span class="tok-kw">${kw}</span>`) +
      save(`<span class="tok-pkg">${pkg}</span>`) +
      sc,
  );

  // 2. Annotations  @Foo
  code = code.replace(/(@[A-Za-z][\w.]*)/g, (m) =>
    save(`<span class="tok-ann">${m}</span>`),
  );

  // 3. String literals (HTML-escaped quotes)  &quot;…&quot;
  code = code.replace(/(&quot;[^&\n]*?&quot;)/g, (m) =>
    save(`<span class="tok-str">${m}</span>`),
  );

  // 4. Keywords
  code = code.replace(
    /\b(public|private|protected|class|interface|export|extends|implements|null|new|return|void|final|static|abstract)\b/g,
    (m) => save(`<span class="tok-kw">${m}</span>`),
  );

  // 5. Java types
  code = code.replace(
    /\b(String|Long|Integer|Double|BigDecimal|Boolean|LocalDateTime|LocalDate|Date|Object|List|Set|Map)\b/g,
    (m) => save(`<span class="tok-type">${m}</span>`),
  );

  // 6. TS primitive types
  code = code.replace(/\b(string|number|boolean|any)\b/g, (m) =>
    save(`<span class="tok-type">${m}</span>`),
  );

  // 7. Line comments
  code = code.replace(/(\/\/[^\n]*)/g, (m) =>
    save(`<span class="tok-cmt">${m}</span>`),
  );

  // 8. Standalone numbers — safe now because placeholder keys are letters only.
  //    Lookbehind/ahead: skip if adjacent to MARK or a letter/underscore (part of identifier).
  code = code.replace(/(?<![A-Za-z_\uE000])\d+(?![A-Za-z_\uE000])/g, (m) =>
    save(`<span class="tok-num">${m}</span>`),
  );

  // Restore all saved spans — key is letters only, no digit ambiguity
  code = code.replace(new RegExp(`${MARK}([a-z]+)${MARK}`, "g"), (_, key) => {
    const idx = keyOf.indexOf(key);
    return idx >= 0 ? spans[idx] : _;
  });
  return code;
}

// ════════════════════════════════════════════════
//  BUILD TS DECORATORS FOR CODE GENERATION
// ════════════════════════════════════════════════
function buildTsColumnDecorator(row) {
  const colName = row.colName || row.original;
  const args = [`name: '${colName}'`];
  if (row.optional) args.push("nullable: true");

  // Length (string types)
  const effLen =
    row.length !== null
      ? row.length
      : row.anns.columnLength !== 255
        ? row.anns.columnLength
        : null;
  if (row.type === "string" && effLen && effLen !== 255)
    args.push(`length: ${effLen}`);

  // Precision / Scale (number types)
  const effPrec =
    row.precision !== null ? row.precision : row.anns.columnPrecision;
  const effScal = row.scale !== null ? row.scale : row.anns.columnScale;
  if (row.type === "number" && (effPrec || effScal)) {
    if (effPrec) args.push(`precision: ${effPrec}`);
    if (effScal) args.push(`scale: ${effScal}`);
  }
  return `@Column({ ${args.join(", ")} })`;
}

// ════════════════════════════════════════════════
//  BUILD OUTPUT CODE WINDOW (TypeScript & Java)
// ════════════════════════════════════════════════
export function buildOutput({
  columnRows,
  currentLang,
  getPascalNameFn,
  includeOrm,
  includeValid,
}) {
  const name = getPascalNameFn();
  let raw = "";

  // ── TypeScript ──
  if (currentLang === "ts") {
    const hasTsOrm = columnRows.some((r) => {
      const effLen =
        r.length !== null
          ? r.length
          : r.anns.columnLength !== 255
            ? r.anns.columnLength
            : null;
      const effPrec =
        r.precision !== null ? r.precision : r.anns.columnPrecision;
      const effScal = r.scale !== null ? r.scale : r.anns.columnScale;
      return (
        (r.type === "string" && effLen && effLen !== 255) ||
        (r.type === "number" && (effPrec || effScal))
      );
    });

    if (hasTsOrm) {
      raw += `import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';\n\n`;
      raw += `@Entity()\n`;
      raw += `export class ${name} {\n`;
      if (!columnRows.length) {
        raw += `  // No columns defined yet\n`;
      } else {
        columnRows.forEach((row) => {
          const isId = row === columnRows[0] && row.anns.isId !== false;
          if (isId) {
            raw += `  @PrimaryGeneratedColumn()\n`;
          } else {
            raw += `  ${buildTsColumnDecorator(row)}\n`;
          }
          const prop = row.optional ? `${row.camel}?` : row.camel;
          raw += `  ${prop}: ${row.type};\n\n`;
        });
      }
      raw += `}\n`;
    } else {
      raw += `export interface ${name} {\n`;
      if (!columnRows.length) {
        raw += `  // No columns defined yet\n`;
      } else {
        columnRows.forEach((row) => {
          const prop = row.optional ? `${row.camel}?` : row.camel;
          raw += `  ${prop}: ${row.type};\n`;
        });
      }
      raw += `}\n`;
    }

    // ── Java ──
  } else {
    const imports = new Set();

    columnRows.forEach((r) => {
      if (r.type === "LocalDateTime")
        imports.add("import java.time.LocalDateTime;");
      if (r.type === "LocalDate") imports.add("import java.time.LocalDate;");
      if (r.type === "BigDecimal") imports.add("import java.math.BigDecimal;");
      if (r.type === "Date") imports.add("import java.util.Date;");
      if (r.type === "List") imports.add("import java.util.List;");
      if (r.type === "Set") imports.add("import java.util.Set;");
      const a = r.anns;
      if (a.notNull)
        imports.add("import jakarta.validation.constraints.NotNull;");
      if (a.notBlank)
        imports.add("import jakarta.validation.constraints.NotBlank;");
      if (a.sizeMin || a.sizeMax)
        imports.add("import jakarta.validation.constraints.Size;");
      if (a.minVal) imports.add("import jakarta.validation.constraints.Min;");
      if (a.maxVal) imports.add("import jakarta.validation.constraints.Max;");
      if (a.email) imports.add("import jakarta.validation.constraints.Email;");
      if (a.pattern)
        imports.add("import jakarta.validation.constraints.Pattern;");
      if (a.relType === "Enumerated")
        imports.add("import jakarta.persistence.EnumType;");
      if (a.relType === "Enumerated")
        imports.add("import jakarta.persistence.Enumerated;");
      if (
        ["OneToOne", "ManyToOne", "OneToMany", "ManyToMany"].includes(a.relType)
      ) {
        imports.add(`import jakarta.persistence.${a.relType};`);
        imports.add("import jakarta.persistence.FetchType;");
        if (a.cascade) imports.add("import jakarta.persistence.CascadeType;");
      }
    });

    if (includeOrm) {
      imports.add("import jakarta.persistence.Column;");
      imports.add("import jakarta.persistence.Entity;");
      imports.add("import jakarta.persistence.GeneratedValue;");
      imports.add("import jakarta.persistence.GenerationType;");
      imports.add("import jakarta.persistence.Id;");
      imports.add("import jakarta.persistence.Table;");
      imports.add("import jakarta.persistence.Transient;");
      imports.add("import lombok.Data;");
      imports.add("import lombok.NoArgsConstructor;");
    }

    if (imports.size) {
      raw += [...imports].sort().join("\n") + "\n\n";
    }

    if (includeOrm) {
      const tbl = toSnakeUpper(name);
      raw += `@Data\n@NoArgsConstructor\n@Entity\n@Table(name = "${tbl}")\n`;
    }
    raw += `public class ${name} {\n\n`;

    if (!columnRows.length) {
      raw += `    // No fields defined yet\n`;
    } else {
      columnRows.forEach((row, i) => {
        const a = row.anns;
        const isId = a.isId;
        const lines = [];
        const dbColName = row.colName || row.original;

        // @Transient short-circuit
        if (a.isTransient) {
          if (includeOrm) lines.push("    @Transient");
          const cmt = row.optional ? " // Optional" : "";
          lines.push(`    private ${row.type} ${row.camel};${cmt}`);
          raw += lines.join("\n") + "\n\n";
          return;
        }

        // Relationship annotations
        if (a.relType === "Enumerated") {
          lines.push(`    @Enumerated(EnumType.${a.enumType})`);
        } else if (
          ["OneToOne", "ManyToOne", "OneToMany", "ManyToMany"].includes(
            a.relType,
          )
        ) {
          const rArgs = [`fetch = FetchType.${a.fetchType}`];
          if (a.cascade) rArgs.push(`cascade = CascadeType.${a.cascade}`);
          if (a.mappedBy && ["OneToMany", "ManyToMany"].includes(a.relType))
            rArgs.push(`mappedBy = "${a.mappedBy}"`);
          lines.push(`    @${a.relType}(${rArgs.join(", ")})`);
        }

        // Bean Validation
        if (includeValid || includeOrm) {
          if (a.notNull) lines.push("    @NotNull");
          if (a.notBlank) lines.push("    @NotBlank");
          if (a.sizeMin || a.sizeMax) {
            const sArgs = [
              a.sizeMin ? `min = ${a.sizeMin}` : "",
              a.sizeMax ? `max = ${a.sizeMax}` : "",
            ]
              .filter(Boolean)
              .join(", ");
            lines.push(`    @Size(${sArgs})`);
          }
          if (a.minVal) lines.push(`    @Min(${a.minVal})`);
          if (a.maxVal) lines.push(`    @Max(${a.maxVal})`);
          if (a.email) lines.push("    @Email");
          if (a.pattern) lines.push(`    @Pattern(regexp = "${a.pattern}")`);
        }

        // JPA ORM annotations
        if (includeOrm) {
          if (isId) {
            lines.push("    @Id");
            if (a.generatedValue && a.generatedValue !== "none")
              lines.push(
                `    @GeneratedValue(strategy = GenerationType.${a.generatedValue})`,
              );
          }
          const colArgs = [`name = "${dbColName}"`];
          if (!a.columnNullable) colArgs.push("nullable = false");
          if (a.columnUnique) colArgs.push("unique = true");
          if (!a.columnInsertable) colArgs.push("insertable = false");
          if (!a.columnUpdatable) colArgs.push("updatable = false");

          // Effective length — inline table input wins over modal
          const effLen = row.length !== null ? row.length : a.columnLength;
          const effPrec =
            row.precision !== null ? row.precision : a.columnPrecision;
          const effScal = row.scale !== null ? row.scale : a.columnScale;

          if (row.type === "String" && effLen && effLen !== 255)
            colArgs.push(`length = ${effLen}`);
          if (
            ["BigDecimal", "Double"].includes(row.type) &&
            (effPrec || effScal)
          ) {
            if (effPrec) colArgs.push(`precision = ${effPrec}`);
            if (effScal) colArgs.push(`scale = ${effScal}`);
          }
          lines.push(
            colArgs.length === 1
              ? `    @Column(name = "${dbColName}")`
              : `    @Column(${colArgs.join(", ")})`,
          );
        }

        const cmt = row.optional ? " // Optional" : "";
        lines.push(`    private ${row.type} ${row.camel};${cmt}`);
        raw += lines.join("\n") + "\n\n";
      });
    }
    raw += `}\n`;
  }

  // Highlight entire block FIRST, then split and add line numbers.
  const highlighted = hl(raw);
  const hlLines = highlighted.split("\n");
  const lined = hlLines
    .map((l, i) => {
      if (i === hlLines.length - 1 && l === "") return "";
      return `<span class="line-num">${i + 1}</span>${l}`;
    })
    .join("\n");

  document.getElementById("codeOutput").innerHTML = lined;

  const ext = currentLang === "ts" ? "ts" : "java";
  const fname = `${name}.${ext}`;
  document.getElementById("filenameLabel").textContent = fname;

  // Update breadcrumb path to match language
  const breadcrumb = document.getElementById("winBreadcrumb");
  if (breadcrumb) {
    if (currentLang === "ts") {
      breadcrumb.innerHTML = `<span>src</span><span class="win-breadcrumb-sep">/</span><span class="win-filename" id="filenameLabel">${fname}</span>`;
    } else {
      breadcrumb.innerHTML = `<span>src</span><span class="win-breadcrumb-sep">/</span><span>main</span><span class="win-breadcrumb-sep">/</span><span>java</span><span class="win-breadcrumb-sep">/</span><span class="win-filename" id="filenameLabel">${fname}</span>`;
    }
  }
  const badge = document.getElementById("outputLangBadge");
  if (currentLang === "ts") {
    badge.textContent = "TS";
    badge.className = "win-lang-badge lang-ts";
  } else {
    badge.textContent = "Java";
    badge.className = "win-lang-badge lang-java";
  }
}

// ════════════════════════════════════════════════
//  BUILD COLUMN MAPPING TABLE ROWS
// ════════════════════════════════════════════════
export function buildTable({ columnRows, currentLang, filterQuery }) {
  const body = document.getElementById("mappingBody");
  const header = document.getElementById("mapHeader");
  const isJava = currentLang === "java";
  const modeClass = isJava ? "java-mode" : "ts-mode";

  header.className = "map-header " + modeClass;

  if (isJava) {
    header.innerHTML = `
      <span>Original</span>
      <span>camelCase</span>
      <span>Type</span>
      <span style="font-size:8px">Len/Prec</span>
      <span style="text-align:center;font-size:8px">Opt?</span>
      <span style="text-align:center;font-size:8px">@Trn</span>
      <span style="text-align:center;font-size:8px">Ann</span>`;
  } else {
    header.innerHTML = `
      <span>Original</span>
      <span>camelCase</span>
      <span>Type</span>
      <span style="font-size:8px">Len/Prec</span>
      <span style="text-align:center">Opt?</span>`;
  }

  const total = columnRows.length;
  document.getElementById("colCount").textContent = total + " cols";
  document.getElementById("mapCount").textContent = total + " cols";

  if (!total) {
    body.innerHTML = `<div class="empty"><div class="empty-icon">⌗</div><div class="empty-text">วางชื่อคอลัมน์ในช่องซ้าย<br/>ระบบแปลงให้ทันที</div><div class="empty-cmd">$ paste sql columns →</div></div>`;
    return;
  }

  const types = currentLang === "ts" ? TS_TYPES : JAVA_TYPES;
  const filtered = filterQuery
    ? columnRows.filter(
        (r) =>
          r.original.toLowerCase().includes(filterQuery) ||
          r.camel.toLowerCase().includes(filterQuery),
      )
    : columnRows;

  if (!filtered.length) {
    body.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">ไม่พบผลลัพธ์: "${filterQuery}"</div></div>`;
    return;
  }

  body.innerHTML = filtered
    .map((row, fi) => {
      const i = columnRows.indexOf(row);
      const a = row.anns;
      const opts = types
        .map(
          (t) =>
            `<option value="${t}"${t === row.type ? " selected" : ""}>${t}</option>`,
        )
        .join("");
      const hasCustomAnn = isJava && hasNonDefaultAnns(a);

      let badge = "";
      if (isJava) {
        if (a.isTransient) badge = `<span class="trans-badge">@Trn</span>`;
        else if (a.isId) badge = `<span class="id-badge">@Id</span>`;
        else if (a.relType !== "none")
          badge = `<span class="trans-badge" style="color:var(--amber)">${a.relType.replace("ManyTo", "N:").replace("OneToMany", "1:N").replace("OneToOne", "1:1").replace("ManyToOne", "N:1")}</span>`;
      }

      // Determine which inline control to show based on type
      const isStringType =
        (currentLang === "ts" && row.type === "string") ||
        (currentLang === "java" && row.type === "String");
      const isDecimalType =
        (currentLang === "ts" && row.type === "number") ||
        ["BigDecimal", "Double"].includes(row.type);
      let lenPrecCell = "";
      if (isStringType) {
        const lenVal = row.length !== null ? row.length : "";
        lenPrecCell = `<div class="map-len-wrap">
        <input type="number" class="map-len-inp" value="${lenVal}" min="1" max="65535"
          placeholder="len" title="Length"
          oninput="window.updateRowLen(${i},'length',this.value)" />
      </div>`;
      } else if (isDecimalType) {
        const precVal = row.precision !== null ? row.precision : "";
        const scaleVal = row.scale !== null ? row.scale : "";
        lenPrecCell = `<div class="map-len-wrap">
        <div class="map-len-prec-row">
          <input type="number" class="map-len-inp" value="${precVal}" min="0" max="38"
            placeholder="P" title="Precision"
            oninput="window.updateRowLen(${i},'precision',this.value)" />
          <input type="number" class="map-len-inp" value="${scaleVal}" min="0" max="10"
            placeholder="S" title="Scale"
            oninput="window.updateRowLen(${i},'scale',this.value)" />
        </div>
      </div>`;
      } else {
        lenPrecCell = `<div class="map-len-wrap"><span style="font-size:9px;color:var(--text3)">—</span></div>`;
      }

      const trCheck = isJava
        ? `
      <div class="map-cell-center">
        <input type="checkbox" class="map-cb" ${a.isTransient ? "checked" : ""} onchange="window.updateAnnField(${i},'isTransient',this.checked)" title="@Transient"/>
      </div>`
        : "";

      const annBtn = isJava
        ? `
      <div class="map-cell-center">
        <button class="ann-btn${hasCustomAnn ? " has-ann" : ""}" onclick="window.openModal(${i})" title="Configure Annotations">
          ${hasCustomAnn ? "●" : "⊕"}
        </button>
      </div>`
        : "";

      return `<div class="map-row ${modeClass}" style="animation-delay:${fi * 0.015}s">
      <div class="col-orig">
        <span class="col-orig-text" title="${row.colName || row.original}">${row.colName || row.original}</span>
        ${badge}
      </div>
      <div class="col-camel" title="${row.camel}">${row.camel}</div>
      <div>
        <select class="map-select" onchange="window.updateRow(${i},'type',this.value)">${opts}</select>
      </div>
      ${lenPrecCell}
      <div class="map-cell-center">
        <input type="checkbox" class="map-cb" ${row.optional ? "checked" : ""} onchange="window.updateRow(${i},'optional',this.checked)"/>
      </div>
      ${trCheck}
      ${annBtn}
    </div>`;
    })
    .join("");
}

// ════════════════════════════════════════════════
//  ANNOTATION PREVIEW MODIFIER
// ════════════════════════════════════════════════
export function updateModalPreview(idx, columnRows) {
  if (idx < 0) return;
  const row = columnRows[idx];
  const a = row.anns;
  const isId = a.isId;
  const lines = [];

  if (a.isTransient) {
    lines.push("@Transient");
    lines.push(`private ${row.type} ${row.camel};`);
  } else {
    if (a.relType === "Enumerated")
      lines.push(`@Enumerated(EnumType.${a.enumType})`);
    else if (
      ["OneToOne", "ManyToOne", "OneToMany", "ManyToMany"].includes(a.relType)
    ) {
      let rArgs = `fetch = FetchType.${a.fetchType}`;
      if (a.cascade) rArgs += `, cascade = CascadeType.${a.cascade}`;
      if (a.mappedBy && ["OneToMany", "ManyToMany"].includes(a.relType))
        rArgs += `, mappedBy = "${a.mappedBy}"`;
      lines.push(`@${a.relType}(${rArgs})`);
    }
    if (a.notNull) lines.push("@NotNull");
    if (a.notBlank) lines.push("@NotBlank");
    if (a.sizeMin || a.sizeMax) {
      const s = [
        a.sizeMin ? `min = ${a.sizeMin}` : "",
        a.sizeMax ? `max = ${a.sizeMax}` : "",
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(`@Size(${s})`);
    }
    if (a.minVal) lines.push(`@Min(${a.minVal})`);
    if (a.maxVal) lines.push(`@Max(${a.maxVal})`);
    if (a.email) lines.push("@Email");
    if (a.pattern) lines.push(`@Pattern(regexp = "${a.pattern}")`);
    if (isId) {
      lines.push("@Id");
      if (a.generatedValue && a.generatedValue !== "none")
        lines.push(
          `@GeneratedValue(strategy = GenerationType.${a.generatedValue})`,
        );
    }
    const colName = row.colName || row.original;
    const colArgs = [`name = "${colName}"`];
    if (!a.columnNullable) colArgs.push("nullable = false");
    if (a.columnUnique) colArgs.push("unique = true");
    if (!a.columnInsertable) colArgs.push("insertable = false");
    if (!a.columnUpdatable) colArgs.push("updatable = false");
    // Effective length: inline table value takes priority over modal value
    const effLen = row.length !== null ? row.length : a.columnLength;
    const effPrec = row.precision !== null ? row.precision : a.columnPrecision;
    const effScal = row.scale !== null ? row.scale : a.columnScale;
    if (row.type === "String" && effLen && effLen !== 255)
      colArgs.push(`length = ${effLen}`);
    if (["BigDecimal", "Double"].includes(row.type) && (effPrec || effScal)) {
      if (effPrec) colArgs.push(`precision = ${effPrec}`);
      if (effScal) colArgs.push(`scale = ${effScal}`);
    }
    lines.push(
      colArgs.length === 1
        ? `@Column(name = "${colName}")`
        : `@Column(${colArgs.join(", ")})`,
    );
    lines.push(`private ${row.type} ${row.camel};`);
  }

  document.getElementById("modalPreview").innerHTML = hl(lines.join("\n"));
}

// ════════════════════════════════════════════════
//  BUILD ANNOTATIONS MODAL INTERFACE
// ════════════════════════════════════════════════
export function openModal(idx, columnRows, activeModalTab) {
  const row = columnRows[idx];
  const a = row.anns;
  document.getElementById("modalColName").textContent =
    row.colName || row.original;
  document.getElementById("modalColCamel").textContent =
    `→ .${row.camel}  :  ${row.type}`;

  const isString = row.type === "String";
  const isNumeric = ["Long", "Integer", "Double", "BigDecimal"].includes(
    row.type,
  );
  const isIdField = a.isId;

  // ── JPA Pane ──
  const jpaPane = `
  <div class="modal-tab-pane active" id="mpane-jpa">

    <div class="ann-group">
      <div class="ann-group-head">
        <span class="ann-group-title">Primary Key</span>
        <span class="ann-check-badge badge-ann">@Id</span>
      </div>
      <div class="ann-group-body">
        <div class="ann-check-row">
          <input type="checkbox" ${a.isId || idx === 0 ? "checked" : ""} onchange="window.toggleIsId(${idx},this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-ann">@Id</span> Primary Key ${idx === 0 ? '<span style="color:var(--text3);font-size:9px">(default: first col — สามารถ uncheck ได้)</span>' : ""}</span>
        </div>
        ${
          isIdField
            ? `
        <div class="ann-sub">
          <label>@GeneratedValue strategy:</label>
          <select onchange="window.setAnn('generatedValue',this.value)">
            <option value="IDENTITY" ${a.generatedValue === "IDENTITY" ? "selected" : ""}>IDENTITY</option>
            <option value="SEQUENCE" ${a.generatedValue === "SEQUENCE" ? "selected" : ""}>SEQUENCE</option>
            <option value="AUTO"     ${a.generatedValue === "AUTO" ? "selected" : ""}>AUTO</option>
            <option value="TABLE"    ${a.generatedValue === "TABLE" ? "selected" : ""}>TABLE</option>
            <option value="none"     ${a.generatedValue === "none" ? "selected" : ""}>none</option>
          </select>
        </div>`
            : ""
        }
      </div>
    </div>

    <div class="ann-group">
      <div class="ann-group-head">
        <span class="ann-group-title">@Column options</span>
        <span class="ann-check-badge badge-col">@Column</span>
      </div>
      <div class="ann-group-body">
        <div class="ann-check-row">
          <input type="checkbox" ${a.isTransient ? "checked" : ""} onchange="window.setAnn('isTransient',this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-ann">@Transient</span> ไม่ map กับ column ใน DB</span>
        </div>
        <div class="ann-check-row">
          <input type="checkbox" ${a.columnUnique ? "checked" : ""} onchange="window.setAnn('columnUnique',this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-col">unique</span> = <code>true</code></span>
        </div>
        <div class="ann-check-row">
          <input type="checkbox" ${!a.columnNullable ? "checked" : ""} onchange="window.setAnn('columnNullable',!this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-col">nullable</span> = <code>false</code> (NOT NULL)</span>
        </div>
        <div class="ann-check-row">
          <input type="checkbox" ${!a.columnInsertable ? "checked" : ""} onchange="window.setAnn('columnInsertable',!this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-col">insertable</span> = <code>false</code></span>
        </div>
        <div class="ann-check-row">
          <input type="checkbox" ${!a.columnUpdatable ? "checked" : ""} onchange="window.setAnn('columnUpdatable',!this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-col">updatable</span> = <code>false</code></span>
        </div>
        ${
          isString
            ? `
        <div class="ann-sub">
          <label>length =</label>
          <input type="number" value="${a.columnLength}" min="1" max="65535" oninput="window.setAnnAndMirror('columnLength',+this.value||255,'length')" style="width:70px"/>
          <span style="color:var(--text3)">(default 255)</span>
        </div>`
            : ""
        }
        ${
          ["BigDecimal", "Double"].includes(row.type)
            ? `
        <div class="ann-sub">
          <label>precision =</label>
          <input type="number" value="${a.columnPrecision || 0}" min="0" max="38" oninput="window.setAnnAndMirror('columnPrecision',+this.value,'precision')" style="width:55px"/>
          <label>scale =</label>
          <input type="number" value="${a.columnScale || 0}" min="0" max="10" oninput="window.setAnnAndMirror('columnScale',+this.value,'scale')" style="width:55px"/>
        </div>`
            : ""
        }
      </div>
    </div>

  </div>`;

  // ── Validation Pane ──
  const validPane = `
  <div class="modal-tab-pane" id="mpane-validation">
    <div class="ann-group">
      <div class="ann-group-head">
        <span class="ann-group-title">Bean Validation</span>
        <span class="ann-check-badge badge-val">jakarta.validation</span>
      </div>
      <div class="ann-group-body">
        <div class="ann-check-row">
          <input type="checkbox" ${a.notNull ? "checked" : ""} onchange="window.setAnn('notNull',this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-val">@NotNull</span> ห้ามเป็น null</span>
        </div>
        ${
          isString
            ? `
        <div class="ann-check-row">
          <input type="checkbox" ${a.notBlank ? "checked" : ""} onchange="window.setAnn('notBlank',this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-val">@NotBlank</span> ห้าม null / ว่าง / whitespace</span>
        </div>
        <div class="ann-check-row">
          <input type="checkbox" ${a.sizeMin || a.sizeMax ? "checked" : ""} id="m-sizeEnabled" onchange="window.toggleSizeInputs(this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-val">@Size</span> กำหนดความยาว String</span>
        </div>
        <div class="ann-sub" id="sizeInputs" style="${a.sizeMin || a.sizeMax ? "" : "display:none"}">
          <label>min =</label>
          <input type="number" value="${a.sizeMin || ""}" min="0" oninput="window.setAnn('sizeMin',this.value)" style="width:60px" placeholder="0"/>
          <label>max =</label>
          <input type="number" value="${a.sizeMax || ""}" min="1" oninput="window.setAnn('sizeMax',this.value)" style="width:60px" placeholder="255"/>
        </div>
        <div class="ann-check-row">
          <input type="checkbox" ${a.email ? "checked" : ""} onchange="window.setAnn('email',this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-val">@Email</span> ต้องเป็นรูปแบบ email</span>
        </div>
        <div class="ann-check-row">
          <input type="checkbox" ${a.pattern ? "checked" : ""} id="m-patEnabled" onchange="window.togglePatternInput(this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-val">@Pattern</span> regexp validation</span>
        </div>
        <div class="ann-sub" id="patInput" style="${a.pattern ? "" : "display:none"}">
          <label>regexp =</label>
          <input type="text" value="${a.pattern || ""}" oninput="window.setAnn('pattern',this.value)" style="width:200px" placeholder="[A-Za-z0-9]+"/>
        </div>
        `
            : ""
        }
        ${
          isNumeric
            ? `
        <div class="ann-check-row">
          <input type="checkbox" ${a.minVal || a.maxVal ? "checked" : ""} id="m-minEnabled" onchange="window.toggleMinMax(this.checked)"/>
          <span class="ann-check-label"><span class="ann-check-badge badge-val">@Min / @Max</span> กำหนดช่วงค่า numeric</span>
        </div>
        <div class="ann-sub" id="minMaxInputs" style="${a.minVal || a.maxVal ? "" : "display:none"}">
          <label>@Min =</label>
          <input type="number" value="${a.minVal || ""}" oninput="window.setAnn('minVal',this.value)" style="width:70px"/>
          <label>@Max =</label>
          <input type="number" value="${a.maxVal || ""}" oninput="window.setAnn('maxVal',this.value)" style="width:70px"/>
        </div>
        `
            : ""
        }
        ${
          !isString && !isNumeric
            ? `
        <div style="font-size:10px;color:var(--text3);font-family:var(--font-mono);padding:6px 0">
          เปลี่ยน type เป็น String หรือ numeric เพื่อ unlock validation เพิ่มเติม
        </div>`
            : ""
        }
      </div>
    </div>
  </div>`;

  // ── Relationship Pane ──
  const REL_OPTIONS = [
    {
      value: "none",
      icon: "⊘",
      label: "None",
      sub: "ไม่มี relationship",
      color: "var(--text3)",
      dim: "rgba(100,120,150,.08)",
      border: "var(--border2)",
    },
    {
      value: "OneToOne",
      icon: "⟷",
      label: "@OneToOne",
      sub: "1 Entity ↔ 1 Entity",
      color: "var(--indigo)",
      dim: "var(--indigo-dim)",
      border: "rgba(124,106,247,.35)",
    },
    {
      value: "ManyToOne",
      icon: "⟶",
      label: "@ManyToOne",
      sub: "Many rows → 1 parent",
      color: "var(--cyan)",
      dim: "var(--cyan-dim)",
      border: "rgba(93,216,240,.35)",
    },
    {
      value: "OneToMany",
      icon: "⟵",
      label: "@OneToMany",
      sub: "1 parent → List of children",
      color: "var(--amber)",
      dim: "var(--amber-dim)",
      border: "rgba(255,179,71,.35)",
    },
    {
      value: "ManyToMany",
      icon: "⟺",
      label: "@ManyToMany",
      sub: "List ↔ List (join table)",
      color: "var(--rose)",
      dim: "var(--rose-dim)",
      border: "rgba(240,98,146,.35)",
    },
    {
      value: "Enumerated",
      icon: "≡",
      label: "@Enumerated",
      sub: "Java Enum mapping",
      color: "var(--green-str)",
      dim: "rgba(134,239,172,.08)",
      border: "rgba(134,239,172,.35)",
    },
  ];

  function buildRelCard(opt, currentRelType) {
    const isActive = currentRelType === opt.value;
    const activeStyle = isActive
      ? "border-color:" +
        opt.border +
        ";background:" +
        opt.dim +
        ";box-shadow:0 0 0 1px " +
        opt.border +
        ";"
      : "";
    const labelColor = isActive ? "color:" + opt.color : "";
    const check = isActive ? '<span class="rel-card-check">✓</span>' : "";
    return (
      '<button class="rel-card' +
      (isActive ? " rel-card-active" : "") +
      '" onclick="window.setRelType(\'' +
      opt.value +
      "')\"" +
      ' style="' +
      activeStyle +
      '">' +
      '<span class="rel-card-icon" style="color:' +
      opt.color +
      '">' +
      opt.icon +
      "</span>" +
      '<span class="rel-card-label" style="' +
      labelColor +
      '">' +
      opt.label +
      "</span>" +
      '<span class="rel-card-sub">' +
      opt.sub +
      "</span>" +
      check +
      "</button>"
    );
  }

  const relCards = REL_OPTIONS.map((opt) => buildRelCard(opt, a.relType)).join(
    "",
  );
  const isRelType = [
    "OneToOne",
    "ManyToOne",
    "OneToMany",
    "ManyToMany",
  ].includes(a.relType);

  // FetchType + Cascade + mappedBy rows
  let relOptionsHtml = "";
  if (isRelType) {
    const lazyActive = a.fetchType === "LAZY" ? " active-lazy" : "";
    const eagerActive = a.fetchType === "EAGER" ? " active-eager" : "";
    const fetchHint =
      a.fetchType === "LAZY" ? "โหลดเมื่อใช้งาน (แนะนำ)" : "โหลดพร้อม Entity";

    const cascadeOptions = [
      ["", "— none —"],
      ["ALL", "ALL"],
      ["PERSIST", "PERSIST"],
      ["MERGE", "MERGE"],
      ["REMOVE", "REMOVE"],
      ["REFRESH", "REFRESH"],
    ]
      .map((pair) => {
        return (
          '<option value="' +
          pair[0] +
          '"' +
          (a.cascade === pair[0] ? " selected" : "") +
          ">" +
          pair[1] +
          "</option>"
        );
      })
      .join("");
    const cascadeHint = a.cascade
      ? '<span class="rel-opt-hint" style="color:var(--amber)">CascadeType.' +
        a.cascade +
        "</span>"
      : "";

    let mappedByRow = "";
    if (a.relType === "OneToMany" || a.relType === "ManyToMany") {
      mappedByRow =
        '<div class="rel-opt-row">' +
        '<div class="rel-opt-label"><span class="rel-opt-icon">↩</span><span>mappedBy</span></div>' +
        '<input class="rel-text-inp" type="text" value="' +
        (a.mappedBy || "") +
        '"' +
        ' oninput="window.setAnn(\'mappedBy\',this.value)" placeholder="ownerFieldName"/>' +
        '<span class="rel-opt-hint">field ใน owning side</span>' +
        "</div>";
    }

    relOptionsHtml =
      '<div class="rel-options-grid">' +
      '<div class="rel-opt-row">' +
      '<div class="rel-opt-label"><span class="rel-opt-icon">⚡</span><span>FetchType</span></div>' +
      '<div class="rel-toggle-pair">' +
      '<button class="rel-toggle-btn' +
      lazyActive +
      "\" onclick=\"window.setAnn('fetchType','LAZY')\">LAZY</button>" +
      '<button class="rel-toggle-btn' +
      eagerActive +
      "\" onclick=\"window.setAnn('fetchType','EAGER')\">EAGER</button>" +
      "</div>" +
      '<span class="rel-opt-hint">' +
      fetchHint +
      "</span>" +
      "</div>" +
      '<div class="rel-opt-row">' +
      '<div class="rel-opt-label"><span class="rel-opt-icon">⛓</span><span>CascadeType</span></div>' +
      '<select class="rel-select" onchange="window.setAnn(\'cascade\',this.value)">' +
      cascadeOptions +
      "</select>" +
      cascadeHint +
      "</div>" +
      mappedByRow +
      "</div>";
  }

  // Enum options
  let enumOptionsHtml = "";
  if (a.relType === "Enumerated") {
    const strActive = a.enumType === "STRING" ? " active-lazy" : "";
    const ordActive = a.enumType === "ORDINAL" ? " active-eager" : "";
    const enumHint =
      a.enumType === "STRING" ? "บันทึกชื่อ enum (แนะนำ)" : "บันทึกเลข index";
    enumOptionsHtml =
      '<div class="rel-options-grid">' +
      '<div class="rel-opt-row">' +
      '<div class="rel-opt-label"><span class="rel-opt-icon">≡</span><span>EnumType</span></div>' +
      '<div class="rel-toggle-pair">' +
      '<button class="rel-toggle-btn' +
      strActive +
      "\" onclick=\"window.setAnn('enumType','STRING')\">STRING</button>" +
      '<button class="rel-toggle-btn' +
      ordActive +
      "\" onclick=\"window.setAnn('enumType','ORDINAL')\">ORDINAL</button>" +
      "</div>" +
      '<span class="rel-opt-hint">' +
      enumHint +
      "</span>" +
      "</div>" +
      "</div>";
  }

  const showOptions = isRelType || a.relType === "Enumerated";
  const optionsSectionLabel = showOptions
    ? '<div class="rel-section-label" style="margin-top:4px"><span style="color:var(--amber)">⚙</span> ตั้งค่า @' +
      a.relType +
      "</div>"
    : "";
  const optionsBox = showOptions
    ? '<div class="rel-options-box">' +
      relOptionsHtml +
      enumOptionsHtml +
      "</div>"
    : "";

  const relPane =
    '<div class="modal-tab-pane" id="mpane-relationship">' +
    '<div class="rel-section-label"><span style="color:var(--amber)">⬡</span> เลือก Annotation Type</div>' +
    '<div class="rel-card-grid">' +
    relCards +
    "</div>" +
    optionsSectionLabel +
    optionsBox +
    "</div>";

  document.getElementById("modalBody").innerHTML =
    jpaPane + validPane + relPane;

  // Activate correct tab
  document
    .querySelectorAll(".modal-tab")
    .forEach((t) =>
      t.classList.toggle("active", t.dataset.pane === activeModalTab),
    );
  document
    .querySelectorAll(".modal-tab-pane")
    .forEach((p) =>
      p.classList.toggle("active", p.id === "mpane-" + activeModalTab),
    );

  updateModalPreview(idx, columnRows);
  document.getElementById("annModal").classList.add("open");
}