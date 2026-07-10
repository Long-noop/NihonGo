#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix mixed Latin/Japanese characters in hiragana fields across all page JSON files.
Each fix is manually specified based on the correct Japanese reading.
"""

import json
import os
import re

PAGES_DIR = r"c:\Users\ADMIN\OneDrive\Máy tính\N3\data\pages"

# Manual fixes: (filename, line_number_approx, old_hiragana_value, correct_hiragana_value)
# Collected from grep results
FIXES = {
    "page-1.json": [
        # line 7: "いちにchỉ" -> "いちにち" (一日 = いちにち)
        ("いちにchỉ", "いちにち"),
        # line 98: "ふ안" -> "ふあん" (不安 = ふあん) -- Korean char mixed
        ("ふ안", "ふあん"),
        # line 129: "きゅうryou" -> "きゅうりょう" (丘陵 = きゅうりょう)
        ("きゅうryou", "きゅうりょう"),
        # line 306: wrong key "ぼにゅう" used instead of "hiragana" - handled separately
        # line 315: "しゅうryou" -> "しゅうりょう" (終了 = しゅうりょう)
        ("しゅうryou", "しゅうりょう"),
        # line 336: "きょうsō" -> "きょうそう" (競争 = きょうそう)
        ("きょうsō", "きょうそう"),
        # line 599: "だいhyou" -> "だいひょう" (代表 = だいひょう)
        ("だいhyou", "だいひょう"),
        # line 693: "つ伝える" -> "つたえる" (伝える = つたえる)
        ("つ伝える", "つたえる"),
        # line 771: "But và chỉ viết" word is in Vietnamese - fix word field
        # Actually "ただしがき" hiragana is correct; the "word" field has Vietnamese text.
        # This is a different type of error - the word field has "But và chỉ viết" instead of "但し書き"
    ],
    "page-2.json": [
        # line 346: "かchi" -> "かち" (価値 = かち)
        ("かchi", "かち"),
        # line 423: "niseもの" -> "にせもの" (偽物 = にせもの)
        ("niseもの", "にせもの"),
    ],
    "page-3.json": [
        # line 267: "ha" -> "は" (刃 = は)
        # But "ha" = は in romaji, so correct is は
        # However we need to be careful: 刃 = は
        # line 511: "bóc gỡ" is Vietnamese, not Japanese - should be "はがす" (剥がす = はがす)
        ("bóc gỡ", "はがす"),
    ],
    "page-4.json": [
        # line 615: "しょうhin" -> "しょうひん" (商品 = しょうひん)
        ("しょうhin", "しょうひん"),
    ],
    "page-5.json": [
        # line 163: "noroi" -> "のろい" (呪い = のろい)
        ("noroi", "のろい"),
        # line 399: "hakarù" -> "はかる" (図る = はかる)
        ("hakarù", "はかる"),
    ],
    "page-6.json": [
        # line 214: "hatsúbai" -> "はつばい" (発売 = はつばい)
        ("hatsúbai", "はつばい"),
        # line 253: "がいこk" -> "がいこく" (外国 = がいこく)
        ("がいこk", "がいこく"),
    ],
    "page-7.json": [
        # line 8: "totsuぐ" -> "とつぐ" (嫁ぐ = とつぐ)
        ("totsuぐ", "とつぐ"),
        # line 742: "hatてんする" -> "はってんする" (発展する = はってんする)
        ("hatてんする", "はってんする"),
    ],
    "page-8.json": [
        # line 26: "toざん" -> "とざん" (登山 = とざん)
        ("toざん", "とざん"),
    ],
    "page-10.json": [
        # line 236: "たいmaんな" -> "たいまんな" (怠慢な = たいまんな)
        ("たいmaんな", "たいまんな"),
        # line 563: "origami" -> "おりがみ" (折り紙 = おりがみ)
        ("origami", "おりがみ"),
    ],
    "page-12.json": [
        # line 525: "ざんてi" -> "ざんてい" (暫定 = ざんてい)
        ("ざんてi", "ざんてい"),
    ],
    "page-14.json": [
        # line 196: "Percentageははおや" -> "ははおや" (母親 = ははおや)
        ("Percentageははおや", "ははおや"),
        # line 566: "ぶんぴつ / Bunぴ" -> "ぶんぴつ / ぶんぴ" (分泌 = ぶんぴつ or ぶんぴ)
        ("ぶんぴつ / Bunぴ", "ぶんぴつ / ぶんぴ"),
    ],
    "page-15.json": [
        # line 167: "てんがいこđộc" -> "てんがいこどく" (天涯孤独 = てんがいこどく)
        ("てんがいこđộc", "てんがいこどく"),
        # line 231: "hark" -> "はかる" (測る = はかる)
        # line 300: "しつdo" -> "しつど" (湿度 = しつど)
        ("しつdo", "しつど"),
        # line 369: "toどこおる" -> "とどこおる" (滞る = とどこおる)
        ("toどこおる", "とどこおる"),
        # line 562: "niigata-ken" -> "にいがたけん" (新潟県 = にいがたけん)
        ("niigata-ken", "にいがたけん"),
        # line 581: "hark" -> "はげしい" (激しい = はげしい)
        # line 603: hiragana "のうdo" -> "のうど" (濃度 = のうど)
        ("のうdo", "のうど"),
        # line 628: "se to mo no" -> "せともの" (瀬戸物 = せともの)
        ("se to mo no", "せともの"),
        # line 629: "せto giwa" -> "せとぎわ" (瀬戸際 = せとぎわ)
        ("せto giwa", "せとぎわ"),
        # line 746: "moえる" -> "もえる" (燃える = もえる)
        ("moえる", "もえる"),
    ],
    "page-16.json": [
        # line 66: "むryou" -> "むりょう" (無料 = むりょう)
        ("むryou", "むりょう"),
        # line 283: "haへん" -> "はへん" (破片 = はへん)
        ("haへん", "はへん"),
        # line 481: "きょうki" -> "きょうき" (狂気 = きょうき)
        ("きょうki", "きょうき"),
        # line 727: "chỉnmi" -> "ちんみ" (珍味 = ちんみ) -- Vietnamese char mixed
        ("chỉnmi", "ちんみ"),
        # line 857: "かんぺきna" -> "かんぺきな" (完璧な = かんぺきな)
        ("かんぺきna", "かんぺきな"),
    ],
    "page-17.json": [
        # line 27: "sebu" -> "せぶ" or "せぼ"? 畝歩 = せぶ
        ("sebu", "せぶ"),
        # line 35: "kin-kichi-hou" -> "きんきちほう" (近畿地方 = きんきちほう)
        # Actually 近畿地方 = きんきちほう? No, = きんきちほう? 
        # 近畿地方 = きんきちほう -> きんきちほう
        # Actually: 近畿地方 = きんきちほう? Let me think: 近=きん, 畿=き, 地=ち, 方=ほう
        # So = きんきちほう
        ("kin-kichi-hou", "きんきちほう"),
        # line 43: "kaso" -> "かそ" (過疎 = かそ)
        ("kaso", "かそ"),
        # line 265: "ko-kyo" -> "こうきょ" (皇居 = こうきょ)
        ("ko-kyo", "こうきょ"),
        # line 266: "ko-tei" -> "こうてい" (皇帝 = こうてい)
        ("ko-tei", "こうてい"),
        # line 402: "mou-dou-ken" -> "もうどうけん" (盲導犬 = もうどうけん)
        ("mou-dou-ken", "もうどうけん"),
        # line 578: "tameru" -> "ためる" (矯める = ためる)
        ("tameru", "ためる"),
        # line 606: "けんma" -> "けんま" (研磨 = けんま)
        ("けんma", "けんま"),
        # line 748: "とうhyou" -> "とうひょう" (投票 = とうひょう)
        ("とうhyou", "とうひょう"),
    ],
    "page-20.json": [
        # line 915: "hわれる" -> "はれる" (腫れる = はれる)
        ("hわれる", "はれる"),
    ],
    "page-22.json": [
        # line 1105: "hatsumoude / はつもうde" -> "はつもうで" (初詣 = はつもうで)
        ("hatsumoude / はつもうde", "はつもうで"),
        # line 1298: "かいdanする" -> "かいだんする" (会談する = かいだんする)
        ("かいdanする", "かいだんする"),
    ],
    "page-23.json": [
        # line 42: "hakarut" -> "はかる" (諮る = はかる)
        ("hakarut", "はかる"),
        # line 607: "hasiru" -> "はしる" (走る = はしる)
        ("hasiru", "はしる"),
    ],
    "page-26.json": [
        # line 277: "ひnanする" -> "ひなんする" (避難する = ひなんする)
        ("ひnanする", "ひなんする"),
        # line 754: "や養う / やstateう" -> "やしなう" (養う = やしなう)
        ("や養う / やstateう", "やしなう"),
    ],
}

# Special fixes that require changing a key name (not the value)
SPECIAL_FIXES = {
    "page-1.json": [
        # line 306: { "word": "母乳", "ぼにゅう": "ほうちょう", "meaning": "Sữa mẹ" }
        # The key "ぼにゅう" should be "hiragana" and value should be "ぼにゅう"
        # Also the value "ほうちょう" is wrong (that's 包丁), should be "ぼにゅう"
        ('"ぼにゅう": "ほうちょう"', '"hiragana": "ぼにゅう"'),
        # line 693: the word itself has kanji embedded: "つ伝える" - already handled above
    ],
}

# Word field fixes (where the "word" field contains Vietnamese/Latin instead of Japanese)
WORD_FIXES = {
    "page-1.json": [
        # line 771: { "word": "But và chỉ viết", "hiragana": "ただしがき", "meaning": "..." }
        # "But và chỉ viết" should be "但し書き"
        ('"word": "But và chỉ viết"', '"word": "但し書き"'),
    ],
    "page-15.json": [
        # line 603: { "word": "nong do", "hiragana": "のうdo", "meaning": "Nồng độ" }
        # "word" should be "濃度", "hiragana" should be "のうど" (already handled in FIXES)
        ('"word": "nong do"', '"word": "濃度"'),
    ],
    "page-15.json_extra": [
        # line 231: { "word": "測る", "hiragana": "hark", ... } - "hark" should be "はかる"
        # Handled in FIXES dict but "hark" and "hark" appear twice - need specific fix
    ],
}

# "hark" appears in 2 different entries in page-15 - let's handle carefully
# line 231: 測る = はかる
# line 581: 激しい = はげしい


def fix_file(filepath, fixes, special_fixes, word_fixes):
    """Apply all fixes to a file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    changes = []
    
    # Apply hiragana value fixes
    for old_val, new_val in fixes:
        if old_val in content:
            content = content.replace(old_val, new_val)
            changes.append(f"  '{old_val}' -> '{new_val}'")
    
    # Apply special key fixes
    for old_str, new_str in special_fixes:
        if old_str in content:
            content = content.replace(old_str, new_str)
            changes.append(f"  KEY FIX: '{old_str}' -> '{new_str}'")
    
    # Apply word field fixes
    for old_str, new_str in word_fixes:
        if old_str in content:
            content = content.replace(old_str, new_str)
            changes.append(f"  WORD FIX: '{old_str}' -> '{new_str}'")
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {os.path.basename(filepath)}:")
        for c in changes:
            print(c)
    else:
        print(f"No changes: {os.path.basename(filepath)}")
    
    return len(changes)


def main():
    total_changes = 0
    
    for filename, hiragana_fixes in FIXES.items():
        filepath = os.path.join(PAGES_DIR, filename)
        if not os.path.exists(filepath):
            print(f"WARNING: {filepath} not found!")
            continue
        
        special = SPECIAL_FIXES.get(filename, [])
        words = []
        # Collect word fixes for this file
        for wf_filename, wf_list in WORD_FIXES.items():
            if wf_filename == filename or wf_filename == filename + "_extra":
                words.extend(wf_list)
        
        count = fix_file(filepath, hiragana_fixes, special, words)
        total_changes += count
    
    # Handle files with only special fixes (no hiragana fixes listed)
    for filename, special_list in SPECIAL_FIXES.items():
        if filename not in FIXES:
            filepath = os.path.join(PAGES_DIR, filename)
            if os.path.exists(filepath):
                count = fix_file(filepath, [], special_list, [])
                total_changes += count
    
    print(f"\nTotal: {total_changes} fixes applied.")
    
    # Special case: page-15.json has TWO entries with "hark"
    # 測る -> はかる, 激しい -> はげしい
    # Since both replaced "hark" in one pass, we need to check manually
    p15 = os.path.join(PAGES_DIR, "page-15.json")
    with open(p15, 'r', encoding='utf-8') as f:
        content15 = f.read()
    
    # The replacements above might have done both in one pass via FIXES["page-15.json"]
    # Let's verify "hark" is gone
    if "hark" in content15:
        print("WARNING: 'hark' still found in page-15.json, manual review needed")
    else:
        print("page-15.json: 'hark' successfully replaced")


if __name__ == "__main__":
    main()
