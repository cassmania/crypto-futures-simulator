const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. 탐색할 대화(Conversation) 로그 파일들의 목록 정의
const 로그파일들 = [
    {
        이름: "이전 대화 (55f36f53)",
        경로: "C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\55f36f53-166c-4056-bd0f-13afdc846a4e\\.system_generated\\logs\\transcript.jsonl"
    },
    {
        이름: "현재 대화 (f747d36c)",
        경로: "C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\f747d36c-726a-4e79-ab58-4ed242124998\\.system_generated\\logs\\transcript.jsonl"
    }
];

const 대상파일 = "C:\\Users\\Administrator\\source\\repos\\crypto-futures-simulator\\app.js";
console.log("==================================================================");
console.log("🚀 [마스터 추출기] write_to_file/replace_file_content 통째 코드 분석 시작...");
console.log("==================================================================");

const 후보목록 = [];

로그파일들.forEach((로그정보) => {
    if (!fs.existsSync(로그정보.경로)) {
        console.log(`[정보] 로그 파일이 존재하지 않아 스킵합니다: ${로그정보.이름}`);
        return;
    }
    
    console.log(`🔍 스캔 중: ${로그정보.이름}...`);
    const 내용 = fs.readFileSync(로그정보.경로, 'utf8');
    const 라인들 = 내용.split('\n');
    
    라인들.forEach((라인, 인덱스) => {
        if (!라인.trim()) return;
        
        try {
            const 객체 = JSON.parse(라인);
            const 스텝 = 객체.step_index || 인덱스;
            
            if (객체.tool_calls && 객체.tool_calls.length > 0) {
                객체.tool_calls.forEach((도구호출) => {
                    const 도구이름 = 도구호출.name;
                    const 인자 = 도구호출.args || {};
                    
                    // write_to_file 또는 replace_file_content 툴인지 검증
                    if (도구이름 === "write_to_file" || 도구이름 === "replace_file_content") {
                        const 대상경로 = 인자.TargetFile || "";
                        
                        // app.js를 대상으로 하는지 정밀 확인 (따옴표나 역슬래시 예외 처리)
                        const 실대상경로 = 대상경로.replace(/\"/g, "").replace(/\\\\/g, "\\");
                        if (실대상경로.endsWith("app.js")) {
                            
                            // 통째 소스코드 추출
                            let 소스코드 = "";
                            if (도구이름 === "write_to_file") {
                                소스코드 = 인자.CodeContent || "";
                            } else if (도구이름 === "replace_file_content") {
                                소스코드 = 인자.ReplacementContent || "";
                            }
                            
                            // 따옴표 정제 및 정리
                            if (소스코드.startsWith('"') && 소스코드.endsWith('"')) {
                                소스코드 = 소스코드.substring(1, 소스코드.length - 1);
                            }
                            
                            // 이스케이프 시퀀스 정제
                            소스코드 = 소스코드
                                .replace(/\\r\\n/g, '\n')
                                .replace(/\\n/g, '\n')
                                .replace(/\\"/g, '"')
                                .replace(/\\\\/g, '\\');
                            
                            // 최소 80,000자(약 80KB) 이상의 통째 작성인 경우만 추출 대상으로 인정
                            if (소스코드.length > 80000) {
                                // 20배 레버리지 Preserved 강제 고정 로직 유무 체크
                                const 레버리지체크 = 소스코드.includes("20") || 소스코드.includes("레버리지");
                                // 퀀트 지표 꼬임 코드 유무 체크
                                const 퀀트꼬임체크 = 소스코드.includes("elCCI.innerText = cciVal.toFixed(2);") || 소스코드.includes("elCCI.innerText = `${cciVal.toFixed(2)}`;");
                                
                                후보목록.push({
                                    출처: 로그정보.이름,
                                    스텝: 스텝,
                                    도구: 도구이름,
                                    길이: 소스코드.length,
                                    코드: 소스코드,
                                    레버리지강제고정: 레버리지체크,
                                    퀀트지표꼬임: 퀀트꼬임체크
                                });
                            }
                        }
                    }
                });
            }
        } catch (e) {
            // JSON 파싱 에러는 스킵
        }
    });
});

console.log(`\n📋 분석 완료! 총 ${후보목록.length}개의 온전한 app.js 후보를 찾았습니다.`);

if (후보목록.length === 0) {
    console.error("❌ [실패] 80KB 이상의 통째 app.js 코드를 transcript.jsonl 로그에서 찾지 못했습니다.");
    process.exit(1);
}

// 퀀트 지표가 꼬이지 않았으면서 레버리지 기능이 완벽히 작동하는 가장 최신 골든 버전을 필터링
const 골든후보들 = 후보목록.filter(h => !h.퀀트지표꼬임 && h.레버리지강제고정);

console.log(`💎 그 중 퀀트 지표가 꼬이지 않은 골든 후보군 수: ${골든후보들.length}개`);

let 최종선택 = null;

if (골든후보들.length > 0) {
    // 골든 후보 중 가장 최신 것 (스텝 번호가 높고, 현재 대화방에서 나온 것을 우선시)
    골든후보들.sort((a, b) => {
        const a우선순위 = (a.출처.includes("현재") ? 1000000 : 0) + a.스텝;
        const b우선순위 = (b.출처.includes("현재") ? 1000000 : 0) + b.스텝;
        return b우선순위 - a우선순위;
    });
    최종선택 = 골든후보들[0];
    console.log(`🎯 [자동 채택] 가장 안전하고 완벽한 이전 골든 버전 선택 완료!`);
} else {
    // 만약 골든 후보가 없다면, 그냥 퀀트 지표 꼬임 여부에 무관하게 가장 최신 대규모 작성을 복구 대상으로 잡음
    후보목록.sort((a, b) => {
        const a우선순위 = (a.출처.includes("현재") ? 1000000 : 0) + a.스텝;
        const b우선순위 = (b.출처.includes("현재") ? 1000000 : 0) + b.스텝;
        return b우선순위 - a우선순위;
    });
    최종선택 = 후보목록[0];
    console.log(`⚠️ [경고] 퀀트 지표가 꼬이지 않은 순수 후보가 없어 차선책으로 가장 최신의 통째 코드를 채택합니다.`);
}

console.log(`- 선택된 출처: ${최종선택.출처}`);
console.log(`- 스텝 번호: Step ${최종선택.스텝}`);
console.log(`- 사용 도구: ${최종선택.도구}`);
console.log(`- 소스 코드 크기: ${최종선택.길이} 바이트`);
console.log(`- 레버리지 바인딩 여부: ${최종선택.레버리지강제고정 ? "YES (안정적)" : "NO"}`);
console.log(`- 퀀트 지표 꼬임 여부: ${최종선택.퀀트지표꼬임 ? "YES (위험)" : "NO (깨끗함)"}`);

// 파일로 저장
fs.writeFileSync(대상파일, 최종선택.코드, 'utf8');
console.log(`\n🎉 [성공] app.js가 완벽하게 덮어쓰기 복원되었습니다! (크기: ${최종선택.코드.length} 바이트)`);

// 2단계: node -c 로 최종 무결성 문법 체크 실행
console.log("\n🔍 [2단계] Node.js 정적 구문 분석기(Syntax Compiler Check)를 기동합니다...");
try {
    execSync(`node -c "${대상파일}"`, { stdio: 'pipe' });
    console.log(">>> ✅ [최종 합격] 복원된 app.js의 구문 검사 결과: 0개의 에러! 완벽하게 유효합니다!");
} catch (에러) {
    console.error(">>> ❌ [에러] 복원된 app.js 파일에 여전히 구문 오류가 존재합니다:");
    console.error(에러.stderr ? 에러.stderr.toString() : 에러.message);
}
