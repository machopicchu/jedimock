(function(global){
  function sanitizeJson(source){
    let result = "";
    let inString = false;
    let escape = false;
    for(let i = 0; i < source.length; i++){
      const ch = source[i];
      const code = source.charCodeAt(i);
      if(escape){
        result += ch;
        escape = false;
        continue;
      }
      if(ch === "\\"){
        escape = true;
        result += ch;
        continue;
      }
      if(ch === "\""){
        inString = !inString;
        result += ch;
        continue;
      }
      if(inString && code < 32){
        if(code === 10) result += "\\n";
        else if(code === 13) result += "\\r";
        else if(code === 9) result += "\\t";
        else result += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }
      result += ch;
    }
    return result;
  }

  function computeLineDiff(left, right){
    const m = left.length;
    const n = right.length;
    const dp = [];

    for(let i = 0; i <= m; i++){
      dp[i] = [];
      for(let j = 0; j <= n; j++) dp[i][j] = 0;
    }
    for(let i = m - 1; i >= 0; i--){
      for(let j = n - 1; j >= 0; j--){
        if(left[i] === right[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const ops = [];
    let i = 0;
    let j = 0;
    while(i < m || j < n){
      if(i < m && j < n && left[i] === right[j]){
        ops.push({ type: "same", l: left[i], r: right[j] });
        i++;
        j++;
      } else if(j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])){
        ops.push({ type: "add", l: null, r: right[j] });
        j++;
      } else {
        ops.push({ type: "remove", l: left[i], r: null });
        i++;
      }
    }

    const pairs = [];
    let k = 0;
    while(k < ops.length){
      if(ops[k].type === "same"){
        pairs.push(ops[k]);
        k++;
      } else {
        const removes = [];
        const adds = [];
        while(k < ops.length && ops[k].type === "remove"){
          removes.push(ops[k].l);
          k++;
        }
        while(k < ops.length && ops[k].type === "add"){
          adds.push(ops[k].r);
          k++;
        }
        while(k < ops.length && ops[k].type === "remove"){
          removes.push(ops[k].l);
          k++;
        }
        const len = Math.max(removes.length, adds.length);
        for(let p = 0; p < len; p++){
          const l = p < removes.length ? removes[p] : null;
          const r = p < adds.length ? adds[p] : null;
          if(l !== null && r !== null) pairs.push({ type: "change", l, r });
          else if(l !== null) pairs.push({ type: "remove", l, r: null });
          else pairs.push({ type: "add", l: null, r });
        }
      }
    }
    return pairs;
  }

  function inlineDiff(a, b, escapeHtml){
    const m = a.length;
    const n = b.length;
    if(m === 0 && n === 0) return { left: "", right: "" };
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for(let i = m - 1; i >= 0; i--){
      for(let j = n - 1; j >= 0; j--){
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    let left = "";
    let right = "";
    let i = 0;
    let j = 0;
    while(i < m || j < n){
      if(i < m && j < n && a[i] === b[j]){
        left += escapeHtml(a[i]);
        right += escapeHtml(b[j]);
        i++;
        j++;
      } else {
        let leftChunk = "";
        let rightChunk = "";
        while(i < m && (j >= n || dp[i][j + 1] < dp[i + 1][j] || (dp[i][j + 1] === dp[i + 1][j] && j >= n))){
          leftChunk += a[i];
          i++;
        }
        while(j < n && (i >= m || dp[i + 1][j] < dp[i][j + 1] || (dp[i + 1][j] === dp[i][j + 1] && i >= m))){
          rightChunk += b[j];
          j++;
        }
        if(!leftChunk && !rightChunk && i < m && j < n){
          leftChunk = a[i++];
          rightChunk = b[j++];
        }
        if(leftChunk) left += '<mark class="diff-word-left">' + escapeHtml(leftChunk) + "</mark>";
        if(rightChunk) right += '<mark class="diff-word-right">' + escapeHtml(rightChunk) + "</mark>";
      }
    }
    return { left, right };
  }

  const api = {
    sanitizeJson,
    computeLineDiff,
    inlineDiff
  };

  global.JediMockDiffCore = api;
  if(typeof module !== "undefined" && module.exports){
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
